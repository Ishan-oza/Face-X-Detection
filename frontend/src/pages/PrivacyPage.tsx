import { LegalLayout, TeamContacts, type LegalSection } from '../components/LegalLayout';
import { PageLink } from '../lib/navigation';
import { useDocumentTitle } from '../lib/hooks';

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <>
        <p>
          This policy explains what information Face-X Detection handles when you use the website, why, and where it
          goes. Face-X Detection is run by the project team listed on the{' '}
          <PageLink to="/about#team">About page</PageLink>. If anything here is unclear, contact us using the details at
          the end.
        </p>
      </>
    ),
  },
  {
    id: 'images',
    title: 'Images you analyse',
    body: (
      <>
        <p>When you run an analysis, the image you choose is sent to the Face-X analysis service so the model can examine it.</p>
        <ul>
          <li>The image is checked first in your browser (format, file signature, size and whether it can be decoded).</li>
          <li>
            On the server, the image is decoded and analysed in memory and the result is returned to your browser. The
            analysis service does not save uploaded images to disk or to a database.
          </li>
          <li>
            Results are kept only in your current browser tab and are cleared when you refresh or close it. They are not
            stored on our servers.
          </li>
          <li>PDF and JSON reports are generated in your browser and saved only where you choose to save them.</li>
        </ul>
        <p>
          Only upload images you have the right to use. Avoid uploading images of other people without their permission.
        </p>
      </>
    ),
  },
  {
    id: 'predictions',
    title: 'AI predictions',
    body: (
      <p>
        Analysis results are automated outputs of a machine-learning model. They are produced on request and are not
        used to build profiles of you or of the people in your images. See the{' '}
        <PageLink to="/terms">Terms of Service</PageLink> for the limitations of these results.
      </p>
    ),
  },
  {
    id: 'reviews',
    title: 'Reviews and feedback',
    body: (
      <>
        <p>If you submit a review on the home page, we collect:</p>
        <ul>
          <li>your star rating and feedback text;</li>
          <li>the name you enter, if any (the name field is optional);</li>
          <li>the time of submission and an internal review ID.</li>
        </ul>
        <p>
          Reviews are stored in a private Google Sheet managed by the project team, using a Google Apps Script that only
          our server can call. Every review starts as pending and is read by the team before anything is published.
          Only reviews the team approves are shown publicly, with the name you gave (or “Anonymous”), the rating, the
          feedback and the date. Pending and rejected reviews are not shown on the website.
        </p>
        <p>
          To limit spam and repeated submissions, our server briefly keeps your IP address and a fingerprint of your
          review text in memory. They are not written to the Google Sheet and are discarded within about a day, or when
          the server restarts.
        </p>
        <p>To have your review corrected or removed, email any member of the team listed below.</p>
      </>
    ),
  },
  {
    id: 'technical',
    title: 'Technical data and logs',
    body: (
      <p>
        Like most web services, our server and our hosting provider may record standard request information such as
        your IP address, the time, the page or API address requested and the response status. These logs are used to
        operate and secure the service and are not used for advertising.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <ul>
        <li>
          <strong>Google</strong> stores and processes reviews through Google Sheets and Google Apps Script, under
          Google’s own terms and privacy policy.
        </li>
        <li>
          <strong>Google Fonts</strong> serves the website’s typefaces. When a page loads, your browser requests the
          fonts from Google’s servers, which receive your IP address.
        </li>
        <li>
          <strong>Hosting provider</strong>. The website and analysis service run on infrastructure provided by a
          hosting company, which processes network traffic to deliver the service.
        </li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and tracking',
    body: (
      <p>
        The website does not set cookies, does not use analytics or advertising trackers, and does not store data in
        your browser’s local storage.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        We take reasonable steps to protect information: integration credentials are kept on the server and never sent
        to browsers, reviews are moderated before publishing, and inputs are validated. No online service can be
        guaranteed to be completely secure, so please don’t include sensitive personal information in reviews.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>We may update this policy as the service changes. The date at the top shows when it was last revised.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <>
        <p>For questions about this policy or to request removal of a review, contact the team:</p>
        <TeamContacts />
      </>
    ),
  },
];

export function PrivacyPage() {
  useDocumentTitle('Privacy Policy');
  return (
    <LegalLayout
      label="Privacy Policy"
      title={
        <>
          Privacy <em className="text-signal">Policy.</em>
        </>
      }
      intro="How Face-X Detection handles uploaded images, analysis results and reviews."
      updated="2 November 2026"
      sections={SECTIONS}
    />
  );
}
