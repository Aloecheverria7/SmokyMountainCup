import { GalleryImages, InquiryForm } from './shared';
export function Gallery() {
  return (
    <main id="main-content" className="cup-section">
      <p className="cup-eyebrow">FROM THE SIDELINES</p>
      <h1>Moments from the Cup</h1>
      <p>Click a photograph to view the original.</p>
      <div className="cup-gallery">
        <GalleryImages />
      </div>
    </main>
  );
}
