import { GalleryImages, InquiryForm } from './shared';
export function Sorry() {
  return (
    <main id="main-content" className="cup-section">
      <h1>We could not send your message.</h1>
      <p>
        Please try again or email{' '}
        <a href="mailto:smokymountaincup@yahoo.com">
          smokymountaincup@yahoo.com
        </a>
        .
      </p>
      <a href="contact.php">Return to contact</a>
    </main>
  );
}
