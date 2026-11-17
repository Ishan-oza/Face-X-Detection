/**
 * Static content for the About page, drawn from PROJECT_MASTER_CONTEXT.md and
 * swin_local_training.ipynb. It describes the system's architecture, the role
 * of each component, and nothing about their runtime status. Live model
 * availability always comes from GET /api/models.
 */

export interface Stage {
  id: string;
  title: string;
  summary: string;
  /** Components that act at this stage, shown as labels. */
  components?: string[];
}

export const PIPELINE: Stage[] = [
  {
    id: '01',
    title: 'Validation & safe decoding',
    summary:
      'Uploads are checked for format, file signature and the 10 MB limit in the browser. On the server, the image is re-validated, protected against decompression bombs and converted to RGB.',
  },
  {
    id: '02',
    title: 'Face detection & alignment',
    summary:
      'Faces are located and aligned into a 256 × 256 crop. When no face is found, the image is routed to full-image analysis with a clear notice instead of failing.',
    components: ['MTCNN'],
  },
  {
    id: '03',
    title: 'Frequency-residual analysis',
    summary:
      'Fixed high-pass filter banks strip away image content and keep the noise residual, where generator fingerprints and checkerboard artefacts become visible.',
    components: ['SRM filters'],
  },
  {
    id: '04',
    title: 'Blending-boundary analysis',
    summary: 'The face and its surroundings are examined for the seams that splicing, Poisson blending or colour transfer leave behind.',
    components: ['Face X-ray', 'Deep Faceguard'],
  },
  {
    id: '05',
    title: 'Transformer classification',
    summary:
      'Vision transformers classify the image as Fake or Real from local texture and global structure, while a scene-level branch looks for artefacts across the full frame.',
    components: ['Swin Transformer V2', 'Cross-ViT', 'GAR engine'],
  },
  {
    id: '06',
    title: 'Geometric consistency',
    summary: 'Monocular depth and a dense 3D face mesh test whether the face is physically plausible: depth, symmetry and landmark geometry.',
    components: ['Depth Anything V2', 'MediaPipe Face Mesh'],
  },
  {
    id: '07',
    title: 'Late fusion',
    summary: 'Scores from the analysis branches are weighted and combined into a single verdict with a per-branch breakdown.',
    components: ['Fusion layer'],
  },
  {
    id: '08',
    title: 'Explainability',
    summary: 'Gradient-based attention maps highlight the regions that most influenced a “Fake” verdict.',
    components: ['Grad-CAM'],
  },
  {
    id: '09',
    title: 'Results report',
    summary: 'The API returns structured JSON (verdict, class probabilities, metadata and any overlays), rendered on the Results page exactly as received.',
  },
];

export type ModelGroup = 'Preprocessing' | 'Classification' | 'Forensic signal' | 'Geometry' | 'Fusion' | 'Explainability';

export interface ModelCard {
  /** Stable slug, used for keys and element ids. */
  id: string;
  name: string;
  group: ModelGroup;
  /** One-line role in the architecture. */
  role: string;
  /** What it looks at, and why that matters for synthetic-image detection. */
  detail: string;
  input: string;
  output: string;
  /** Three short key points shown in the expanded view. */
  points: [string, string, string];
}

export const MODELS: ModelCard[] = [
  {
    id: 'mtcnn',
    name: 'MTCNN',
    group: 'Preprocessing',
    role: 'Finds and aligns faces before analysis.',
    detail:
      'A cascade of three small CNNs proposes, refines and localises face boxes and five landmarks. Aligning every face to the same crop means the downstream models compare like with like.',
    input: 'Full RGB image',
    output: '256 × 256 aligned face, box, landmarks, or a no-face flag',
    points: [
      'Face bounding box and five facial landmarks',
      'Consistent alignment, so every model examines the same region',
      'A no-face flag that routes the image to full-frame analysis',
    ],
  },
  {
    id: 'srm',
    name: 'SRM filters',
    group: 'Forensic signal',
    role: 'Exposes the noise fingerprint of an image.',
    detail:
      'Spatial Rich Model kernels are fixed high-pass filters from steganalysis. They suppress scene content and amplify the sensor-noise residual, where upsampling artefacts and the frequency suppression of generators show up.',
    input: 'Aligned face',
    output: 'High-frequency residual features',
    points: [
      'Noise residuals left once scene content is filtered out',
      'Checkerboard patterns from generator upsampling',
      'Missing or unnatural high-frequency detail',
    ],
  },
  {
    id: 'face-xray',
    name: 'Face X-ray · Deep Faceguard',
    group: 'Forensic signal',
    role: 'Detects blending seams around a swapped face.',
    detail:
      'Face-swaps paste a generated face into a real photo. A boundary CNN learns to map where two image sources meet, a cue that does not depend on any particular generator.',
    input: 'Face with surrounding context',
    output: 'Blending-boundary map and score',
    points: [
      'Seams where a pasted face meets the original photo',
      'Colour and lighting transitions at the blend boundary',
      'A cue that does not depend on a specific generator',
    ],
  },
  {
    id: 'swin',
    name: 'Swin Transformer V2',
    group: 'Classification',
    role: 'Primary Real / Fake classifier.',
    detail:
      'Attention within shifted local windows, merged across four hierarchical stages, lets the model weigh fine skin, eye and hair texture alongside the overall structure of the face.',
    input: '1 × 3 × 256 × 256 RGB tensor',
    output: 'Fake / Real probabilities',
    points: [
      'Fine texture in skin, eyes and hair',
      'Global facial structure and proportions',
      'Local and long-range context through shifted windows',
    ],
  },
  {
    id: 'cross-vit',
    name: 'Cross-ViT',
    group: 'Classification',
    role: 'Multi-scale transformer classifier.',
    detail:
      'Two transformer branches read the image as small patches (fine detail) and large patches (global context) and exchange information through cross-attention, a complementary view to Swin’s single hierarchy.',
    input: 'Dual-scale RGB inputs',
    output: 'Fake / Real probabilities',
    points: [
      'Small patches for high-frequency detail',
      'Large patches for global context',
      'Cross-attention exchanging information between the two scales',
    ],
  },
  {
    id: 'gar',
    name: 'GAR engine',
    group: 'Forensic signal',
    role: 'Looks for artefacts across the whole scene.',
    detail:
      'Global Artifact Recognition examines texture artefacts across the full frame rather than only the face crop. That covers backgrounds, hands and images where no face can be isolated.',
    input: 'Full image',
    output: 'Scene-level artefact evidence',
    points: [
      'Texture artefacts outside the face: backgrounds, hands, edges',
      'Scene-level inconsistencies across the full frame',
      'Coverage for images where no face can be isolated',
    ],
  },
  {
    id: 'depth',
    name: 'Depth Anything V2',
    group: 'Geometry',
    role: 'Checks the face’s 3D plausibility.',
    detail:
      'A monocular depth model estimates a depth map from a single image. Synthetic faces can show flat regions, warped ears or neck boundaries, or depth that contradicts the lighting.',
    input: 'Aligned face',
    output: 'Depth-inconsistency score',
    points: [
      'Unnaturally flat regions on the face',
      'Warped ear, jaw or neck boundaries',
      'Depth that contradicts the lighting',
    ],
  },
  {
    id: 'face-mesh',
    name: 'MediaPipe Face Mesh',
    group: 'Geometry',
    role: 'Measures landmark geometry and symmetry.',
    detail:
      'Fits a dense mesh of 468 3D landmarks. Displacements and asymmetries that a real face would not have are summarised as a geometric distortion signal.',
    input: 'Aligned face',
    output: 'Landmark symmetry / displacement metric',
    points: [
      '468 3D landmarks fitted to the face',
      'Asymmetries and displacements a real face would not show',
      'Implausible proportions between facial features',
    ],
  },
  {
    id: 'fusion',
    name: 'Late fusion',
    group: 'Fusion',
    role: 'Combines every branch into one verdict.',
    detail:
      'Branch probabilities and forensic scores are weighted and aggregated after each model has run, so a single misleading signal is less likely to decide the outcome on its own.',
    input: 'Outputs of the active branches',
    output: 'Final label, combined confidence, per-branch breakdown',
    points: [
      'Weights the evidence from each branch',
      'Reduces reliance on any single signal',
      'Reports a per-branch breakdown with the final verdict',
    ],
  },
  {
    id: 'grad-cam',
    name: 'Grad-CAM',
    group: 'Explainability',
    role: 'Shows where the evidence is.',
    detail:
      'Gradient-weighted class activation mapping traces the verdict back through the network’s feature maps to the image regions that influenced it most, such as eyes, mouth or hair margins.',
    input: 'Feature maps and gradients',
    output: '256 × 256 heatmap overlay',
    points: [
      'Regions that most influenced the verdict',
      'An overlay on the analysed image',
      'Shown only when computed by the backend',
    ],
  },
];

/** Essential, file-verified facts about the Swin V2 classifier. */
export const SWIN_SPEC: Array<[string, string]> = [
  ['Architecture', 'swinv2_tiny_window16_256 (timm)'],
  ['Parameters', '27.6 M'],
  ['Input', '256 × 256 RGB'],
  ['Output', '2 classes: Fake (0) · Real (1)'],
  ['Weights', 'PyTorch state_dict · ~105 MB'],
];

/** Training configuration recorded in swin_local_training.ipynb. */
export const SWIN_TRAINING: Array<[string, string]> = [
  ['Initialisation', 'ImageNet-pretrained, fine-tuned for 2 classes'],
  ['Dataset', '50,000 images, balanced Fake / Real'],
  ['Split', '40,000 train · 5,000 validation · 5,000 test'],
  ['Preprocessing', 'Resize to 256 × 256, ImageNet mean / std'],
  ['Augmentation', 'Horizontal flip · brightness / contrast jitter (0.1)'],
  ['Optimiser', 'AdamW, lr 1e-4, weight decay 1e-2'],
  ['Schedule', '4 epochs · 3% linear warm-up, then cosine decay'],
  ['Batch', 'Effective 32 via gradient accumulation'],
  ['Precision', 'Mixed precision (bf16, or fp16 where unsupported)'],
  ['Loss', 'Cross-entropy'],
];

export const SWIN_REASONS = [
  {
    title: 'Local windows, global reach',
    body: 'Self-attention is computed inside small windows, keeping fine skin, eye and hair textures in focus. Shifting the windows between layers lets information flow across the whole face.',
  },
  {
    title: 'Hierarchical feature maps',
    body: 'Patches are progressively merged across four stages, so the model sees both pixel-level artefacts and the overall structure of a face, similar to a CNN pyramid.',
  },
  {
    title: 'Scaled cosine attention',
    body: 'V2 replaces dot-product attention with scaled cosine attention and post-normalisation, which stabilises training and avoids a few channels dominating the activations.',
  },
  {
    title: 'Continuous position bias',
    body: 'A log-spaced, learned relative position bias transfers between window sizes and resolutions, which suits the 256 × 256 input.',
  },
];

/** High-level system layers, shown as the architecture overview. */
export const ARCHITECTURE = [
  {
    layer: 'Client',
    title: 'Web interface',
    tech: 'React · TypeScript',
    body: 'Validates the upload (type, file signature, 10 MB), sends it for analysis and renders only what the backend returns.',
  },
  {
    layer: 'API',
    title: 'FastAPI service',
    tech: 'GET /api/health · GET /api/models · POST /api/analyze',
    body: 'Reports server health and model availability, accepts the image and returns a structured JSON result.',
  },
  {
    layer: 'Inference',
    title: 'Detection pipeline',
    tech: 'PyTorch · timm · CUDA / CPU',
    body: 'Preprocessing, the analysis branches and late fusion run on the GPU when one is available, with a CPU fallback.',
  },
  {
    layer: 'Report',
    title: 'Explained result',
    tech: 'Verdict · probabilities · overlays',
    body: 'The verdict, class probabilities, timing and device, and attention overlays whenever the backend computes them.',
  },
];

export const EXPLAINABILITY = [
  {
    title: 'Verdict & probabilities',
    body: 'Every result shows the predicted label together with the full probability for each class, not just a single score.',
  },
  {
    title: 'Attention heatmaps',
    body: 'Grad-CAM overlays show which regions drove a verdict. They are displayed only when the backend computes one and are never simulated.',
  },
  {
    title: 'Per-branch breakdown',
    body: 'Late fusion is designed to report each branch’s contribution alongside the combined verdict, so disagreements stay visible.',
  },
  {
    title: 'Full transparency',
    body: 'Inference time, device, model identifier and the raw API response are available on every result.',
  },
];

export const RESPONSIBLE_USE: Array<[string, string]> = [
  ['Probabilities are not certainty', 'Softmax scores show the model’s preference; they are not calibrated likelihoods.'],
  ['Training distribution matters', 'Images unlike the training data, or from unseen generators, can be misjudged.'],
  ['Still images only', 'Video, audio and temporal deepfake detection are outside the system’s scope.'],
  ['Evidence, not proof', 'Use results as one input to a decision, never as the sole basis for legal or personal action.'],
];

export interface TeamMember {
  name: string;
  email: string;
  linkedin: string;
  github: string;
}

export const TEAM: TeamMember[] = [
  {
    name: 'Lochan P Anchalkar',
    email: 'lochanap2005@gmail.com',
    linkedin: 'https://linkedin.com/in/lochan-p-anchalkar-6b70b02a6',
    github: 'https://github.com/lochan-22',
  },
  {
    name: 'Oza Ishan Pankaj',
    email: 'ishanoza666@gmail.com',
    linkedin: 'https://www.linkedin.com/in/ishan-oza-51a851295',
    github: 'https://github.com/Ishan-oza',
  },
  {
    name: 'Krishna Prashanth S J',
    email: 'kriishnasj12@gmail.com',
    linkedin: 'https://www.linkedin.com/in/krishna-sj-1a204i2',
    github: 'https://github.com/Krishna17ctrl',
  },
  {
    name: 'Prathik M B Math',
    email: 'prathikmath0714@gmail.com',
    linkedin: 'https://www.linkedin.com/in/prathik-math-810080326',
    github: 'https://github.com/PrathikMath',
  },
];

export const STACK = ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'FastAPI', 'PyTorch', 'timm'];
