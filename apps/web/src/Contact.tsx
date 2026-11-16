import { GalleryImages, InquiryForm } from './shared';
export function Contact() {
  return (
    <main id="main-content" className="cup-section">
      <p className="cup-eyebrow">LET’S TALK SOCCER</p>
      <h1>Contact the organizers</h1>
      <div className="cup-form-grid">
        <section>
          <h2>Get in touch</h2>
          <p>
            Questions about registration, teams or the next tournament? Send us
            a message.
          </p>
          <a href="mailto:smokymountaincup@yahoo.com">
            smokymountaincup@yahoo.com
          </a>
        </section>
        <section className="cup-panel">
          <InquiryForm kind="contact">
            <label>
              Name
              <input name="name" maxLength={120} autoComplete="name" required />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                maxLength={160}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Message
              <textarea name="message" maxLength={6000} required></textarea>
            </label>
            <label hidden>
              Leave empty
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <button>Send message</button>
          </InquiryForm>
        </section>
      </div>
    </main>
  );
}
