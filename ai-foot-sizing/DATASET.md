# Vijayasri foot model dataset specification

## Required layout

    dataset/
      train/
        images/
          sample-0001.jpg
        masks/
          sample-0001.png
      val/
        images/
        masks/
      test/
        images/
        masks/

Every image must have a same-named PNG mask. Mask pixels are black (0) for background and white (255) for the visible foot.

## Capture and annotation protocol

- Obtain explicit, documented consent for each image and its use in model development.
- Do not collect names, phone numbers, account identifiers, health information or other unnecessary personal data with images.
- Prefer one bare foot on a plain portrait A4 sheet, photographed from directly above with the full foot visible.
- Include different skin tones, adult and child foot shapes, left/right feet, toe shapes, foot widths, lighting conditions, phone cameras and reasonable foot rotations.
- Annotate the visible foot silhouette only. Exclude paper, floor, clothing and lower leg above the ankle crease. Include heel and all toes.
- Use a consistent boundary policy at the ankle. Exclude ambiguous, occluded or poor-quality samples rather than guessing.
- Store masks at the same pixel dimensions as the source image. Use binary PNG masks.

## Dataset split and leakage

Create train, val and test folders before training. Keep a subject-level split: all images from one person must stay in only one folder. Never put photos of the same person across different splits. The training script reads train and val only; keep test untouched for final evaluation.

## Validation gates

Evaluate foot-mask intersection-over-union and Dice score; heel/toe and widest-point landmark error in millimetres against physical annotations; length and width absolute error and 95th percentile error; UK/India size agreement against independently measured fit outcomes. Report results by size, width, age group, skin tone, device, orientation and lighting.

A small pilot dataset can validate the training pipeline but cannot establish sizing accuracy. Target several hundred consented and carefully labelled images for an initial model iteration, then expand coverage before public release.

## Privacy

The inference API processes an uploaded image in memory and does not save it. For training, store only consented images in access-controlled storage. Define retention and deletion procedures before collecting customer data. Never use customer camera images for training by default.
