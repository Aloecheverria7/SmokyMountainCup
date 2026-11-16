import { GalleryImages, InquiryForm } from './shared';
import { LiveSection, Posters, type FeedState } from './live';
export function Landing({ feed }: { feed: FeedState }) {
  return (
    <main id="main-content">
      <section className="cup-hero">
        <div className="cup-hero-content">
          <p className="cup-eyebrow">TENNESSEE · SMOKY MOUNTAIN CUP</p>
          <h1>
            The game brings
            <br />
            us together.
          </h1>
          <p>
            Every team. Every goal. Follow the action, discover the fixtures and
            be part of the next matchday.
          </p>
          <a className="cup-button" href="tournament.php">
            Explore the tournament ↗
          </a>
        </div>
      </section>
      <LiveSection feed={feed} />
      <Posters posters={feed.data?.posters ?? []} />
      <section className="cup-section">
        <div className="cup-section-heading">
          <div>
            <p className="cup-eyebrow">BE PART OF IT</p>
            <h2>Bring your team to the Cup.</h2>
          </div>
          <a href="about.php">Our story ↗</a>
        </div>
        <div className="cup-form-grid">
          <section className="cup-panel">
            <h3>Team registration inquiry</h3>
            <p className="cup-muted">
              Send your team information. Registration is confirmed by the
              organizers.
            </p>
            <InquiryForm kind="registration">
              <label>
                Team name
                <input name="team_name" maxLength={120} required />
              </label>
              <label>
                Team representative
                <input name="owner" maxLength={120} required />
              </label>
              <label>
                Email
                <input name="email" type="email" maxLength={160} required />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" maxLength={40} required />
              </label>
              <label>
                Players / category of interest
                <textarea
                  name="players_to_enroll"
                  maxLength={6000}
                  required
                ></textarea>
              </label>
              <label hidden>
                Leave empty
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <button>Send registration inquiry</button>
            </InquiryForm>
          </section>
          <section className="cup-panel">
            <h3>Vendors & partners</h3>
            <p className="cup-muted">
              Interested in being part of a matchday? Get in touch with the
              team.
            </p>
            <InquiryForm kind="vendor">
              <label>
                Name
                <input name="name" maxLength={120} required />
              </label>
              <label>
                Email
                <input name="email" type="email" maxLength={160} required />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" maxLength={40} required />
              </label>
              <label>
                Your product or service
                <textarea name="product" maxLength={6000} required></textarea>
              </label>
              <label hidden>
                Leave empty
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <button>Contact the organizers</button>
            </InquiryForm>
          </section>
        </div>
      </section>
      <section className="cup-section">
        <p className="cup-eyebrow">FROM THE SIDELINES</p>
        <h2>Moments from the Cup</h2>
        <div className="cup-gallery">
          <GalleryImages />
        </div>
      </section>
    </main>
  );
}
