import p0 from './pages/about.json';
import p1 from './pages/blog.json';
import p2 from './pages/contact.json';
import p3 from './pages/gallery.json';
import p4 from './pages/games-blocks.json';
import p5 from './pages/games-boxScores.json';
import p6 from './pages/games-calendar.json';
import p7 from './pages/games-details.json';
import p8 from './pages/games-list.json';
import p9 from './pages/games-results.json';
import p10 from './pages/index.json';
import p11 from './pages/leaguetable.json';
import p12 from './pages/player-details.json';
import p13 from './pages/player-gallery.json';
import p14 from './pages/player-list.json';
import p15 from './pages/player-statics.json';
import p16 from './pages/schedule.json';
import p17 from './pages/sorry.json';
import p18 from './pages/thank-you.json';
export interface PublishedPage {
  route: string;
  title: string;
  bodyAttributes: Record<string, string>;
  html: string;
  stylesheets: string[];
  headStyles: string[];
  scripts: string[];
}
export const pages: Record<string, PublishedPage> = {
  '/about.php': p0,
  '/blog.php': p1,
  '/contact.php': p2,
  '/gallery.php': p3,
  '/games-blocks.php': p4,
  '/games-boxScores.php': p5,
  '/games-calendar.php': p6,
  '/games-details.php': p7,
  '/games-list.php': p8,
  '/games-results.php': p9,
  '/': p10,
  '/leaguetable.php': p11,
  '/player-details.php': p12,
  '/player-gallery.php': p13,
  '/player-list.php': p14,
  '/player-statics.php': p15,
  '/schedule.php': p16,
  '/sorry.php': p17,
  '/thank-you.php': p18,
};
