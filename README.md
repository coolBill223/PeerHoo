# PeerHoo

PeerHoo is a student built app brings together UVA students through allowing students to match, communicate in real-time, and share/access notes for any UVA course! It aims to create a collaborative and at-your-fingertips environment to help UVA students study smarter. This project was part of academic coursework for **CS 4720 Mobile Application Development** at the University of Virginia. 

## Team Members
- Praggnya Kanungo 
- Zhirui Zhou 
- Zia Yandoc

## Purpose

The purpose of this app is to be a platform for uva students to find study partners in the same classes as them, share and access other people’s notes (all the notes have an associated rating and comments that help the user pick which notes to access, and users can also rate and add comments), chat with their study partners in real time. Students can fill out a course matching form to request study partners based on their classes and preferences. Once matched, they can message each other through a real-time chat system. Students can also upload their notes in image or PDF format, which are stored and displayed with author info, ratings, and comments. PeerHoo includes a search and filter system to help students quickly find relevant notes for the course. Additionally, students have personalized profile pages where they can edit their bio, upload an avatar, and manage their courses, notes, and matches.

Here's some detailing of each of the larger features:

### Study Partner Matching
- Students add themselves to a course they are taking by fillin out an "Add Course" form by inputting course numbers and study goals
- After that, they can browse matching results with student profiles
- They can click to view avatars, bios, and contact information of these other students
- Finally, they can click "Apply" to connect with students in your courses
- Likewise, other students can apply to connect with you and you can accept of reject their application

### Real-Time Chat
- Once connected with a peer, you can message them
- The chat is real-time so it helps student collaborate and "text" each other without sharing their private numbers
- The interface is very user-friendly as it ressembles any standard chat interface (such as iMessage or Instragram)

### Note Sharing System
- Users can upload notes via pdf or image input
- Users can browse and search notes by course
- Users can rate and comment on study materials (and they can edit both their reviews and comments, and also delete their comments)
- Each note has a detailed note views with title, author, rating, content, and comments

### User Profiles
- Users can customize their bio and avatar

### Blocking and Reporting System
- Users can block and/or report their study partners
- Once someone is blocked, the blocked personnel will not be notified. However, the user who blocked them will nto recieve any message or interaction from the blocked personnel.
- Users can also manage their blocked partners and unblock any or all of them at anytime

## Tech Stack

### Frontend
- **React Native** 
- **Expo** 
- **Navigation** 

### Backend & Database
- **Firebase Authentication** 
- **Firestore** 
- **Firebase Realtime Database** 
- **Firebase Storage** 

### External Course API
All course metadata is pulled live from the public **UVA SIS REST API** – see the official docs  
<https://s23.cs3240.org/sis-api.html>.  
We build dynamic query URLs (e.g. `...IScript_ClassSearch?...`) to fetch JSON about
departments, courses and sections, then cache the results in Firestore for fast lookup in-app. :contentReference[oaicite:0]{index=0}

## Dependencies

This project uses:

- React Native via [Expo](https://expo.dev)
- Firebase (Authentication, Firestore, Realtime Database, Storage)
- React Navigation
- Expo document/image picker
- React Native Gesture Handler & Reanimated
- Other packages listed in `package.json`

To install:
npm install
npx expo install

## To Run the Program

Before starting, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

You can install Expo CLI globally via:

```bash
npm install -g expo-cli
```
Then run the program:
```
git clone https://github.com/coolBill223/PeerHoo.git
cd my-app
npm install
npx expo install
npx expo start
```

## Development Timeline

This entire project was completed over a 25-day development cycle. In the beginning of these 25 days, we defined our timeline to be the following:

- **Week 1**: Authentication and basic UI setup
- **Week 2**: Matching system and chat implementation  
- **Week 3**: Note sharing functionality
- **Week 4**: Testing, refinement, and deployment

However, due to the enthusiastic approach of all of the team members, we were able to implement features much faster than expected and were done with the working version of our app as early as the beginning of Week 3. We used the extra time to beta test our app as well as seek feedback from our Professor Daniel Graham. We used the final week for the creation of our demo video and final submission of the project. 

## Repository Structure
This follows a service-oriented architecture. Consider the my-app directory as the root here. Based on that:

- All UI components are in /screens
- All of the Business logic are in /backend services
- Any configuration files are at root level
- All static assets organized in /assets

## Demo Video

Here is a demo video that walks through the app: 

## APK Link:

Here is an APK link that could be download and useL: https://drive.google.com/drive/folders/1shc5NYDjWCnG9lewCyOiIe6tTHqY2fLA?usp=sharing
## License

This project is licensed under the MIT License. Please view the LICENSE file for the full description.
