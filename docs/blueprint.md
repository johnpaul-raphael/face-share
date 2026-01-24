# **App Name**: FaceShare

## Core Features:

- User Authentication: Implement user registration, login with JWT-based authentication, and protected routes.
- Face Profile Creation: Allow users to upload 3-5 face images, index faces using AWS Rekognition, and manage/delete face data with explicit consent.
- Event Management: Enable users to create events (name, description), generate invite links/join codes, and join existing events.
- Photo Upload: Implement bulk photo upload for events using S3 presigned URLs, with non-blocking upload processing.
- Face Detection and Matching: Automatically detect faces in uploaded photos using AWS Rekognition, match them against event participants, and assign photos based on match confidence, with manual review for low-confidence matches.
- Manual Review: Allow event owners to review low-confidence face matches, and approve or remove photo recipients per photo, supported by a tool to list all photos with low-confidence matches and present the matches with detected faces, allowing the event owner to determine to whom the photos should be delivered.
- Photo Delivery: Provide each user with a 'My Photos' gallery to view and download photos they appear in via presigned S3 URLs.

## Style Guidelines:

- Primary color: Deep purple (#673AB7), suggestive of high tech and security.
- Background color: Light gray (#EEEEEE), offering a neutral, non-distracting backdrop.
- Accent color: Teal (#009688), for contrast and a sense of trustworthiness.
- Body and headline font: 'Inter' (sans-serif) for a modern, neutral look.
- Use flat, modern icons to represent different actions and categories, with an emphasis on clarity and usability.
- Mobile-first responsive design with a clean, modular layout. Prioritize ease of navigation and quick access to essential features.
- Subtle transitions and animations to enhance user experience. For example, a loading animation when processing photos or a smooth transition between pages.