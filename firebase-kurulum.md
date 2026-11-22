# Kendi Firebase hesabınızı kurun (ücretsiz, ~5 dakika)

Programlar telefon ile bilgisayar arasındaki eşitlemeyi **sizin kendi** ücretsiz Firebase hesabınız üzerinden yapar.
Kayıtlarınız yalnızca sizin hesabınızda durur; günlük ücretsiz sınır da yalnızca size aittir.

1. **https://console.firebase.google.com** adresine Google hesabınızla girin → **Proje ekle** (Add project).
   Bir ad verin (ör. `benim-defterim`), Google Analytics'i kapatabilirsiniz → **Proje oluştur**.
2. Sol menü **Build › Authentication** → **Get started** → **Sign-in method** → **Email/Password** → **Etkinleştir** → Kaydet.
3. Sol menü **Build › Firestore Database** → **Create database** → konum seçin (ör. `eur3`) → **production mode** → Oluştur.
4. Firestore'da **Rules** (Kurallar) sekmesine şunu yapıştırıp **Publish** deyin:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
5. Sol üstte ⚙ **Project settings** → aşağıda **Your apps** → **</>** (Web) simgesi → bir ad yazın → **Register app**.
   Çıkan `const firebaseConfig = { … };` bloğunun tamamını kopyalayın.
6. Programda **Ayarlar › Eşitleme** bölümüne bu bloğu yapıştırın, bir e-posta ve şifre yazıp **Hesap oluştur** deyin.
   Diğer cihazda aynı bloğu ve aynı e-posta/şifreyi yazıp **Giriş yap** deyin.

Ayarlar'daki **Kullanım Limitleri** kartı bugünkü kullanımınızı ve sınırın ne kadarının dolduğunu gösterir
(ücretsiz plan: günde 50.000 okuma, 20.000 yazma, 20.000 silme).

Yapay zekâ kullanan programlarda (fotoğraftan okuma vb.) kendi ücretsiz Gemini anahtarınızı
**https://aistudio.google.com/apikey** adresinden alıp programın ayarına yapıştırın.

---

# Set up your own Firebase account (free, ~5 minutes)

The programs sync your phone and computer through **your own** free Firebase account. Your records live only in your
account, and the daily free quota is yours alone.

1. Go to **https://console.firebase.google.com** with your Google account → **Add project** → give it a name → **Create project**.
2. **Build › Authentication** → **Get started** → **Sign-in method** → **Email/Password** → **Enable** → Save.
3. **Build › Firestore Database** → **Create database** → choose a location → **production mode** → Create.
4. In Firestore open **Rules**, paste the rules above and click **Publish**.
5. ⚙ **Project settings** → **Your apps** → **</>** (Web) → enter a name → **Register app**. Copy the whole
   `const firebaseConfig = { … };` block.
6. In the program open **Settings › Sync**, paste the block, type an email and password and click **Create account**.
   On the other device paste the same block and use the same email/password with **Sign in**.

For AI features, get your own free Gemini key at **https://aistudio.google.com/apikey** and paste it into the program's setting.

---

# أنشئ حساب Firebase الخاص بك (مجاني، نحو 5 دقائق)

تتم مزامنة الهاتف والحاسوب عبر حساب Firebase **الخاص بك** المجاني. تبقى سجلاتك في حسابك فقط، والحد اليومي المجاني لك وحدك.

1. ادخل إلى **https://console.firebase.google.com** بحساب Google ← **Add project** ← اكتب اسماً ← **Create project**.
2. **Build › Authentication** ← **Get started** ← **Sign-in method** ← **Email/Password** ← **Enable** ← حفظ.
3. **Build › Firestore Database** ← **Create database** ← اختر الموقع ← **production mode** ← إنشاء.
4. في Firestore افتح **Rules** والصق القواعد أعلاه ثم **Publish**.
5. ⚙ **Project settings** ← **Your apps** ← **</>** (Web) ← اكتب اسماً ← **Register app**. انسخ كتلة
   `const firebaseConfig = { … };` كاملة.
6. في البرنامج افتح **الإعدادات › المزامنة**، الصق الكتلة، اكتب بريداً وكلمة مرور ثم **إنشاء حساب**.
   على الجهاز الآخر الصق الكتلة نفسها واستخدم البريد وكلمة المرور نفسيهما مع **تسجيل الدخول**.

لميزات الذكاء الاصطناعي احصل على مفتاح Gemini المجاني من **https://aistudio.google.com/apikey** والصقه في إعداد البرنامج.
