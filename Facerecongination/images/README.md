# Face Recognition Training Images

**This folder is auto-populated when you add students/teachers via the frontend.**

## How It Works:

1. Add a student or teacher in the admin dashboard
2. Capture 5 face pictures
3. Click Save
4. Images are automatically saved here in a folder named after the person
5. Training runs automatically to generate embeddings

## Folder Structure:

```
images/
├── John_Smith/          ← Created automatically
│   ├── image_1.jpg      ← Saved from frontend
│   ├── image_2.jpg
│   ├── image_3.jpg
│   ├── image_4.jpg
│   └── image_5.jpg
└── Jane_Doe/
    ├── image_1.jpg
    └── ...
```

## Manual Addition (Optional):

If you need to add images manually:
1. Create a folder with the person's exact name
2. Add 3-5 clear face photos (.jpg, .jpeg, .png)
3. Run `python train.py` to generate embeddings

## Image Quality Tips:

- Clear, well-lit photos
- Face clearly visible
- Different angles for better accuracy
- One person per image
