# 🛠️ FRIENDS_README.md (Internal Dev Guide)

Welcome to the internal repo for Face-X-Detection (VeriStream)! 

## Quick Setup (Windows & Linux)

1. **Get the Heavy Weights:** 
   Grab the `.pth` model checkpoints from here: [Google Drive Weights Link](https://drive.google.com/drive/folders/1xVFQWLqyRjNJHr747_ACxmBetBCvID4W?usp=sharing). Drop `swin_best.pth`, `crossvit_best_checkpoint.pth`, and `class_to_idx.json` right into the main folder.
2. **Install Packages:** 
   Activate your Conda environment (or standard python venv) and run:
   ```bash
   pip install -r requirements.txt
   ```
3. **Test it:**
   ```bash
   python run_cli.py /path/to/test_image.jpg
   ```

# 🎨 Frontend Developer Instructions (Important)

If you are building or adapting a custom frontend (React, Next.js, or modifying the existing Streamlit ```app.py```), please read this carefully to ensure you don't break the forensic backend.
1. What to Touch vs. What to Leave Alone

- ⛔ DO NOT TOUCH the ```veristream/``` folder: This folder contains the highly sensitive neural network router, local/global streams, and the late fusion orchestrator. Changing code here will break the forensic math.

- 🟢 YOUR PLAYGROUND is ```app.py```: This is the current Streamlit GUI. If you are keeping Streamlit, edit this file. If you are building a custom web stack (like Next.js), you will use ```app.py``` as a reference for how to call the backend:
```python
from veristream import VeriStream, Config
engine = VeriStream(Config())
report_json, visual_heatmaps = engine.analyze("image.jpg", use_gemini=True)
```
2. The API Key Requirement (Needs Your Fix)

Right now, ```app.py``` forces the user to enter a Gemini API Key on a welcome screen before they can even access the image upload page.

Your Task: Modify the frontend logic so the Gemini API key is optional.

- The user should be able to upload and test an image without entering an API key.

- If they don't provide a key, simply pass ```use_gemini=False``` when calling ```engine.analyze()```. The backend will automatically fall back to a hardcoded local narrative instead of failing.

- Add a simple toggle or optional settings menu in your UI for "Provide Gemini API Key for Advanced Explanations" rather than hard-locking the app on launch.
