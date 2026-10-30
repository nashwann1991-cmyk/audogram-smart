const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔑 التحقق فقط بالمفتاح
async function activateLicense(key) {
    const docRef = db.collection("activation_keys").doc(key);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, message: "❌ المفتاح غير صحيح" };
    }

    const data = doc.data();

    if (data.isUsed) {
        return { success: false, message: "🚫 المفتاح مستخدم مسبقاً" };
    }

    // تفعيل المفتاح
    await docRef.update({
        isUsed: true,
        activatedAt: new Date()
    });

    return { success: true, message: "🎉 تم التفعيل بنجاح" };
}

module.exports = { activateLicense };