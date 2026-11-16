import { PublishedSite, isPublishedPath } from './published/PublishedSite';
import { Header } from './Header';
import { Footer } from './Footer';
import { Landing } from './Landing';
import { About } from './About';
import { Gallery } from './Gallery';
import { Contact } from './Contact';
import { ThankYou } from './ThankYou';
import { Sorry } from './Sorry';
import { Ticker, useFeed } from './live';
import { MessageError } from './shared';
import { lazy, Suspense } from 'react';
import { Tournament } from './Tournament';
import { PublicMatch } from './PublicMatch';
const AdminApp = lazy(() =>
  import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })),
);
export function App() {
  if (isPublishedPath(location.pathname)) return <PublishedSite />;
  return /^\/admin(?:\/|$)/.test(location.pathname) ? (
    <Suspense
      fallback={
        <main className="cup-section">
          <p role="status">Comprobando sesión…</p>
        </main>
      }
    >
      <AdminApp />
    </Suspense>
  ) : (
    <PublicApp />
  );
}
function PublicApp() {
  const feed = useFeed();
  const path = location.pathname;
  let content;
  switch (path) {
    case '/':
    case '/index.php':
      content = <Landing feed={feed} />;
      break;
    case '/about.php':
      content = <About />;
      break;
    case '/gallery.php':
      content = <Gallery />;
      break;
    case '/contact.php':
      content = <Contact />;
      break;
    case '/thank-you.php':
      content = <ThankYou />;
      break;
    case '/sorry.php':
      content = <Sorry />;
      break;
    case '/message-error':
      content = <MessageError />;
      break;
    case '/tournament.php':
      content = <Tournament feed={feed} />;
      break;
    case '/match.php':
      content = <PublicMatch feed={feed} />;
      break;
    default:
      content = (
        <main id="main-content" className="cup-section">
          <h1>Page not found</h1>
          <a href="index.php">Return home</a>
        </main>
      );
  }
  return (
    <>
      <Header />
      <Ticker feed={feed} />
      {content}
      <Footer />
    </>
  );
}
