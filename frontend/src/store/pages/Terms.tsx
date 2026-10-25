export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[#A61E57]">Terms &amp; Conditions</h1>
      <p className="mt-3 text-gray-600">
        Welcome to MNM Fashion. By accessing our website and placing an order, you agree to the following terms
        and conditions:
      </p>

      <section className="mt-6 space-y-5 text-[15px] leading-relaxed text-gray-700">
        <div>
          <h2 className="font-semibold text-gray-900">1. Orders</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Once an order is placed, it cannot be cancelled under any circumstances.</li>
            <li>Please review your order carefully before confirming your purchase.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">2. Products</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>We ensure that all products are checked before dispatch/pickup.</li>
            <li>Slight variations in color, design, or pattern may occur due to photography and lighting and shall not be considered defects.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">3. Returns, Refunds &amp; Exchanges</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>We do not accept returns and do not provide refunds.</li>
            <li>Exchange is allowed only for defective pieces at the time of pickup.</li>
            <li>Once the product leaves the store, no exchange or complaint will be accepted.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">4. Pricing &amp; Payments</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Prices are subject to change without prior notice.</li>
            <li>Orders will be processed only after successful payment.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">5. Contact</h2>
          <p>For any assistance, feel free to contact us:</p>
          <p className="mt-2">
            📞 Phone: <a href="tel:+918208683401" className="text-[#A61E57] underline">8208683401</a>
            <br />
            📧 Email: <a href="mailto:m.m.boutique.pune@gmail.com" className="text-[#A61E57] underline">m.m.boutique.pune@gmail.com</a>
          </p>
        </div>
      </section>
    </article>
  );
}
