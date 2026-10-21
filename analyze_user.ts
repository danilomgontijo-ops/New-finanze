import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    initializeApp({
        projectId: 'controleorca-3a6f4'
    });
}

const db = getFirestore();

async function run() {
    try {
        console.log("Firestore initialized");
        const settingsSnap = await db.collection("settings").get();
        console.log(`Found ${settingsSnap.size} settings docs`);
        settingsSnap.forEach(doc => {
            console.log("User ID:", doc.id, "Data:", doc.data());
        });
        
        if (settingsSnap.size > 0) {
            const firstUser = settingsSnap.docs[0].id;
            const txsSnap = await db.collection("transactions").where("userId", "==", firstUser).get();
            console.log(`Found ${txsSnap.size} transactions for user ${firstUser}`);
        }
    } catch (e) {
        console.error("Error in run:", e);
    }
}

run();
