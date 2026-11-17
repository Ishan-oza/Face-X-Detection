import { LegalLayout, TeamContacts, type LegalSection } from '../components/LegalLayout';
import { PageLink } from '../lib/navigation';
import { useDocumentTitle } from '../lib/hooks';

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Using Face-X Detection',
    body: (
      <p>
        By using this website you agree to these terms. If you don’t agree, please don’t use the service. These terms
        sit alongside our <PageLink to="/privacy">Privacy Policy</PageLink>.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'What the service does',
    body: (
      <p>
        Face-X Detection analyses still images (JPG, PNG or WebP, up to 10 MB) with a machine-learning model and
        reports whether the model scores each image as more likely real or fake. It is an image-authenticity analysis
        tool, not a source of definitive answers.
      </p>
    ),
  },
  {
    id: 'predictions',
    title: 'Limitations of AI predictions',
    body: (
      <ul>
        <li>Results are automated model outputs and can be wrong, including false “fake” and false “real” verdicts.</li>
        <li>
          Scores are the model’s softmax scores, not calibrated probabilities. A score of 90% does not mean a 90% chance
          that an image is fake.
        </li>
        <li>
          The model was trained on face images. Images unlike its training data, heavily edited or compressed images,
          or images from unfamiliar generators may be misjudged.
        </li>
        <li>
          Results are not legal, forensic or professional advice and must not be the sole basis for decisions that
          affect anyone. Verify important conclusions through other means.
        </li>
      </ul>
    ),
  },
  {
    id: 'responsibilities',
    title: 'Your responsibilities',
    body: (
      <>
        <p>When you use the service, you agree to:</p>
        <ul>
          <li>upload only images you have the right to use, and respect the privacy of people who appear in them;</li>
          <li>not upload unlawful, abusive or exploitative content;</li>
          <li>not use results to harass, defame or make claims about a real person without independent verification;</li>
          <li>
            not interfere with the service, attempt to bypass its limits, or send automated or excessive requests.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'reviews',
    title: 'Reviews',
    body: (
      <>
        <p>
          Reviews must be honest, relate to your experience of Face-X Detection, and must not contain other people’s
          personal information, links, advertising or offensive content.
        </p>
        <p>
          Every review is checked by the team in a private Google Sheet before publication. We may decline or remove
          any review at our discretion. By submitting a review, you allow us to display it publicly on this website,
          together with the name you provide (or “Anonymous”), the rating and the date.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        The service is provided as is and as available. Features may change, and the service may be limited,
        interrupted or discontinued at any time. We don’t promise that it will be error-free or always available.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        To the extent permitted by applicable law, the Face-X Detection team is not liable for losses arising from the
        use of, or reliance on, the service or its results.
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Content and trademarks',
    body: (
      <p>
        The Face-X Detection name, logo and website content belong to the project team. The service is built with
        open-source software, including PyTorch, timm, FastAPI and React, which remain under their own licences. You
        keep any rights you have in the images you analyse.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: <p>We may update these terms. The date at the top shows when they were last revised.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <>
        <p>Questions about these terms can be sent to any member of the team:</p>
        <TeamContacts />
      </>
    ),
  },
];

export function TermsPage() {
  useDocumentTitle('Terms of Service');
  return (
    <LegalLayout
      label="Terms of Service"
      title={
        <>
          Terms of <em className="text-signal">Service.</em>
        </>
      }
      intro="The rules for using Face-X Detection and the limits of its results."
      updated="2 November 2026"
      sections={SECTIONS}
    />
  );
}
