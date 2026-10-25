export default function Contact() {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[#A61E57]">Contact Us</h1>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-gray-900">📍 Our Store Address</h2>
          <address className="mt-2 not-italic leading-relaxed text-gray-700">
            MNM Fashion
            <br />
            Priyanka Market, Ivy Estate Rd,
            <br />
            Near Pavan Putra Kirana Shop,
            <br />
            Near Kolte Patil Main Gate,
            <br />
            Wagholi, Pune, Maharashtra – 412207
          </address>
          <a
            href="https://www.google.com/maps/search/?api=1&query=MNM+Fashion+Priyanka+Market+Ivy+Estate+Rd+Wagholi+Pune+412207"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-[#A61E57] underline"
          >
            Open in Google Maps →
          </a>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-gray-900">🕒 Store Hours</h2>
          <p className="mt-2 text-gray-700">Open daily · Closes at 8:30 PM</p>

          <h2 className="mt-5 font-semibold text-gray-900">📞 Phone</h2>
          <p className="mt-2">
            <a href="tel:+918208683401" className="text-[#A61E57] underline">82 08 68 34 01</a>
          </p>

          <h2 className="mt-5 font-semibold text-gray-900">📧 Email</h2>
          <p className="mt-2">
            <a href="mailto:m.m.boutique.pune@gmail.com" className="text-[#A61E57] underline">m.m.boutique.pune@gmail.com</a>
          </p>
        </div>
      </section>
    </article>
  );
}
