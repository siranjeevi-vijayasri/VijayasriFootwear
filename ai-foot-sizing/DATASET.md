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

## Transfer-learning approach

Use the public Torchvision DeepLabV3-ResNet50 pretrained weights as the initial visual feature extractor. Replace its final classifier with a two-class foot/background head, then fine-tune the model using consented, annotated Vijayasri images. This gives us a Vijayasri-specific model without needing to train a deep vision network from random initialization.

The pretrained weights are only the starting point. The resulting checkpoint and deployed model are trained for this project, and no third-party foot-sizing service or Onefit integration is used.

## Progressive data collection

Do not wait until hundreds of images are available before beginning. Build and validate the pipeline in stages:

1. **Pilot: 20–30 distinct-foot images.** Check annotation consistency, image preprocessing, training stability and whether the model learns a usable foot silhouette. This is a pipeline experiment only, not proof of sizing accuracy.
2. **Early improvement: 50–75 images.** Add more variation in foot shape, skin tone, left/right feet, camera devices and lighting. Review false segmentation and landmark suggestions.
3. **Broader iteration: 100–150 images.** Expand the range of adult/child feet, widths, toe shapes, capture conditions and sizes. Evaluate against people not used for training.
4. **Before public sizing claims: continue collecting a few hundred diverse images and independent physical measurements.** The final dataset size depends on measured performance and coverage, not a fixed image count.

Keep images from each person in only one split. A person must never appear in both training and validation/test, even if they provide multiple images. Augmented copies do not count as additional independent people or images.

## Capture and annotation protocol

- Obtain explicit, documented consent for each image and its use in model development.
- Do not collect names, phone numbers, account identifiers, health information or other unnecessary personal data with images.
- Prefer one bare foot on a plain portrait A4 sheet, photographed from directly above with the full foot visible.
- Follow the customer capture guide: toes toward the top of the portrait image and heel toward the bottom.
- Include different skin tones, adult and child foot shapes, left/right feet, toe shapes, foot widths, lighting conditions, phone cameras and reasonable foot rotations.
- Annotate the visible foot silhouette only. Exclude paper, floor, clothing and lower leg above the ankle crease. Include heel and all toes.
- Use a consistent boundary policy at the ankle. Exclude ambiguous, occluded or poor-quality samples rather than guessing.
- Store masks at the same pixel dimensions as the source image. Use binary PNG masks.

## Dataset split and leakage

Create train, val and test folders before training. Keep a subject-level split: all images from one person must stay in only one folder. Never put photos of the same person across different splits. The training script reads train and val only; keep test untouched for final evaluation.

## Validation gates

Evaluate foot-mask intersection-over-union and Dice score; heel/toe and widest-point landmark error in millimetres against physical annotations; length and width absolute error and 95th percentile error; UK/India size agreement against independently measured fit outcomes. Report results by size, width, age group, skin tone, device, orientation and lighting.

A pilot can validate the training pipeline but cannot establish reliable measurement or shoe-size accuracy. Do not enable customer-facing AI sizing until independent, subject-separated testing shows acceptable measurement errors across the intended customer population.

## Privacy

The inference API processes an uploaded image in memory and does not save it. For training, store only consented images in access-controlled storage. Define retention and deletion procedures before collecting customer data. Never use customer camera images for training by default.
