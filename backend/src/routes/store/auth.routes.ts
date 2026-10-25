import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { requireCustomer } from '../../middleware/customerAuth';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { Customer, type CustomerDoc } from '../../models/Customer';
import { signCustomerToken } from '../../services/storeAuth';
import { stitchAnonymousEvents } from '../../services/storeEvents';
import { normalizePhone, isValidPhone, otpForPhone } from '../../utils/phone';

const router = Router();

const tokenFor = (c: CustomerDoc) => signCustomerToken({ sub: String(c._id), email: c.email ?? '', name: c.name });

// ─────────────────────────────── WhatsApp (phone) OTP login ───────────────────────────────
// The storefront authenticates customers by their WhatsApp/mobile number with a 4-digit OTP.
// The OTP is the LAST 4 DIGITS of the number — a fixed, no-send scheme (no Meta / WhatsApp
// Business API). This is intentionally simple and NOT secure; swap in a real OTP provider to
// harden it. The number is stored so the shop can follow up with customers who don't purchase.

const requestSchema = z.object({ phone: z.string().trim().min(1, 'Enter your WhatsApp number') });

router.post(
  '/otp/request',
  validateBody(requestSchema),
  asyncHandler(async (req, res) => {
    const digits = normalizePhone((req.body as z.infer<typeof requestSchema>).phone);
    if (!isValidPhone(digits)) throw ApiError.badRequest('Enter a valid 10-digit mobile number');
    const existing = await Customer.findOne({ $or: [{ whatsapp: digits }, { phone: digits }] }).lean();
    // No message is sent — the OTP is the number's last 4 digits. We hint that in the response and,
    // outside production, return the OTP itself to make testing easy.
    res.json({
      data: {
        sent: true,
        isNewCustomer: !existing,
        hint: 'Enter the last 4 digits of your mobile number as the OTP.',
        ...(env.isProd ? {} : { devOtp: otpForPhone(digits) }),
      },
    });
  }),
);

const verifySchema = z.object({
  phone: z.string().trim().min(1, 'Enter your WhatsApp number'),
  otp: z.string().trim().min(1, 'Enter the OTP'),
  name: z.string().trim().optional(),
  anonymousId: z.string().trim().optional(),
});

router.post(
  '/otp/verify',
  validateBody(verifySchema),
  asyncHandler(async (req, res) => {
    const { phone, otp, name, anonymousId } = req.body as z.infer<typeof verifySchema>;
    const digits = normalizePhone(phone);
    if (!isValidPhone(digits)) throw ApiError.badRequest('Enter a valid 10-digit mobile number');
    if (normalizePhone(otp) !== otpForPhone(digits)) throw ApiError.unauthorized('Incorrect OTP');

    // Find an existing customer by WhatsApp or phone, else create one. The number is persisted on
    // both `whatsapp` and `phone` so staff can follow up (e.g. abandoned carts).
    let customer = await Customer.findOne({ $or: [{ whatsapp: digits }, { phone: digits }] });
    if (!customer) {
      customer = await Customer.create({
        name: name?.trim() || `Customer ${digits.slice(-4)}`,
        phone: digits,
        whatsapp: digits,
      });
    } else {
      if (!customer.whatsapp) customer.whatsapp = digits;
      if (!customer.phone) customer.phone = digits;
      if (name?.trim() && /^Customer \d{4}$/.test(customer.name)) customer.name = name.trim();
      await customer.save();
    }
    if (!customer.active) throw ApiError.unauthorized('This account is inactive');

    await stitchAnonymousEvents(anonymousId, String(customer._id));
    res.json({ data: { token: tokenFor(customer), customer } });
  }),
);

router.get(
  '/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.customer!.id);
    if (!customer) throw ApiError.notFound('Account not found');
    res.json({ data: customer });
  }),
);

export default router;
