import argparse
import random
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision.models.segmentation import DeepLabV3_ResNet50_Weights, deeplabv3_resnet50

SIZE = 512
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)

def letterbox(image, is_mask=False):
    image = image.convert("L" if is_mask else "RGB")
    scale = min(SIZE / image.width, SIZE / image.height)
    dims = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    resampling = Image.Resampling.NEAREST if is_mask else Image.Resampling.BILINEAR
    resized = image.resize(dims, resampling)
    canvas = Image.new("L" if is_mask else "RGB", (SIZE, SIZE), 0)
    canvas.paste(resized, ((SIZE - dims[0]) // 2, (SIZE - dims[1]) // 2))
    return canvas

class FootDataset(Dataset):
    def __init__(self, root, augment=False):
        self.root = Path(root)
        self.samples = []
        for image_path in sorted((self.root / "images").glob("*")):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                mask_path = self.root / "masks" / (image_path.stem + ".png")
                if mask_path.exists():
                    self.samples.append((image_path, mask_path))
        self.augment = augment
        if not self.samples:
            raise RuntimeError("No paired images and masks found. See DATASET.md.")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        image_path, mask_path = self.samples[index]
        image = letterbox(Image.open(image_path))
        mask = letterbox(Image.open(mask_path), is_mask=True)
        if self.augment and random.random() < 0.5:
            image, mask = ImageOps.mirror(image), ImageOps.mirror(mask)
        x = np.asarray(image, dtype=np.float32) / 255.0
        y = (np.asarray(mask, dtype=np.uint8) > 127).astype(np.int64)
        x = torch.from_numpy(x).permute(2, 0, 1)
        return (x - MEAN) / STD, torch.from_numpy(y)

def dice_score(logits, targets):
    predictions, truth = logits.argmax(dim=1).float(), targets.float()
    intersection = (predictions * truth).sum(dim=(1, 2))
    denominator = predictions.sum(dim=(1, 2)) + truth.sum(dim=(1, 2))
    return ((2 * intersection + 1) / (denominator + 1)).mean()

def build_model(pretrained=True):
    weights = DeepLabV3_ResNet50_Weights.DEFAULT if pretrained else None
    model = deeplabv3_resnet50(weights=weights)
    old = model.classifier[-1]
    model.classifier[-1] = nn.Conv2d(old.in_channels, 2, kernel_size=1)
    return model

def main():
    parser = argparse.ArgumentParser(description="Train Vijayasri's independent foot silhouette model.")
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--output", default="models")
    parser.add_argument("--epochs", type=int, default=35)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=0.0001)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--no-pretrained-backbone", action="store_true")
    args = parser.parse_args()
    torch.manual_seed(42)
    random.seed(42)
    np.random.seed(42)
    dataset = FootDataset(args.data, augment=True)
    validation_size = max(1, int(len(dataset) * 0.2))
    training_size = len(dataset) - validation_size
    if training_size < 2:
        raise RuntimeError("Add more labelled examples. At least 10 paired examples are required for a prototype run.")
    train_set, validation_set = random_split(dataset, [training_size, validation_size],
                                             generator=torch.Generator().manual_seed(42))
    validation_set.dataset.augment = False
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=args.workers)
    validation_loader = DataLoader(validation_set, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(not args.no_pretrained_backbone).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()
    best_dice = 0.0
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        for images, masks in train_loader:
            images, masks = images.to(device), masks.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images)["out"], masks)
            loss.backward()
            optimizer.step()
            train_loss += float(loss.item())
        model.eval()
        scores = []
        with torch.inference_mode():
            for images, masks in validation_loader:
                scores.append(float(dice_score(model(images.to(device))["out"].cpu(), masks)))
        val_dice = float(np.mean(scores))
        print("epoch={}/{} train_loss={:.4f} validation_dice={:.4f}".format(
            epoch, args.epochs, train_loss / max(1, len(train_loader)), val_dice))
        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({"state_dict": model.cpu().state_dict(), "validation_dice": best_dice},
                       output_dir / "best_checkpoint.pth")
            model.to(device)
    checkpoint = torch.load(output_dir / "best_checkpoint.pth", map_location=device, weights_only=False)
    export_model = build_model(pretrained=False).to(device)
    export_model.load_state_dict(checkpoint["state_dict"])
    export_model.eval()
    traced = torch.jit.trace(export_model, torch.zeros(1, 3, SIZE, SIZE, device=device))
    traced.save(str(output_dir / "foot_segmentation.ts"))
    print("Exported models/foot_segmentation.ts; best validation Dice={:.4f}".format(checkpoint["validation_dice"]))
    print("Validate on a separate subject-level test set before any customer-facing accuracy claim.")

if __name__ == "__main__":
    main()
