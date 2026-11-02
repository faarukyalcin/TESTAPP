# DeutschAI

Davetle girişli, AI destekli A1/A2 Almanca öğrenme platformu (Next.js 15 + Supabase + Vercel).

## Kurulum (sırayla)

1. **Supabase projesi aç.** Authentication > Providers > Email içinde **Allow new users to sign up** seçeneğini KAPAT.
2. **SQL:** SQL Editor'de `supabase/setup.sql` dosyasının tamamını çalıştır (sıfırdan kurulum). Mevcut bir veritabanın varsa `supabase/migrations/0002…0005` dosyalarını sırayla çalıştır.
3. **E-posta şablonları** (Authentication > Email Templates). Bağlantıları şöyle değiştir:
   - *Invite user:* `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password">Hesabını oluştur</a>`
   - *Reset password:* `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password">Şifreni sıfırla</a>`
4. **URL Configuration:** Site URL = yayın adresin; Redirect URLs'e `https://ALAN-ADIN/auth/confirm` ekle.
5. **İlk yönetici:** Supabase > Authentication > Users'tan kendine kullanıcı ekle, sonra SQL Editor'de:
   `update public.profiles set role='admin' where id = (select id from auth.users where email='SENIN@EPOSTAN');`
6. **SQL güncellemesi:** Sıfırdan kurulumda `supabase/setup.sql` dosyasının güncel sürümü `platform_ai_settings` tablosunu da oluşturur. Mevcut kurulumda `supabase/migrations/0005_secure_ai_settings.sql` dosyasını çalıştır.
7. **Vercel ortam değişkenleri** (`.env.example` dosyasına bak): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` ve `APP_ENCRYPTION_KEY`. Şifreleme anahtarı için şu komutu çalıştır ve çıktıyı yalnızca Vercel'deki server environment variables alanına ekle:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
8. İlk yönetici hesabıyla giriş yaptıktan sonra `/admin/ai` sayfasından Gemini veya OpenAI sağlayıcısını seç, model adını ve API anahtarını gir. Anahtar AES-256-GCM ile şifrelenir; arayüzde tekrar gösterilmez. İstersen API anahtarını bunun yerine doğrudan Vercel `GEMINI_API_KEY` veya `OPENAI_API_KEY` değişkeni olarak da tanımlayabilirsin.
9. GitHub'a it, Vercel'e bağla.

`SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY` ve AI anahtarları yalnızca sunucuda kullanılır; `NEXT_PUBLIC_` ile başlamaz. `.env` dosyalarını commit etme. `APP_ENCRYPTION_KEY` kaybolursa panelde şifrelenmiş olarak tutulan AI anahtarının şifresi çözülemez; güvenli bir yedek tut.

## Geliştirme
```
npm install
cp .env.example .env.local
npm run dev        # geliştirme
npm test           # birim testleri
npm run build      # üretim derlemesi
```

## Özellikler ve sınırlar (dürüst durum)
Çalışan: davetle kayıt, giriş/çıkış, şifre sıfırlama, zorunlu seviye testi (sunucuda puanlanır), AI kişisel plan (ilerlemeye göre güncellenir), AI öğretmen (geçmişi ve zayıf yönleri kullanır), dersler + testler, SM-2 aralıklı tekrarlı kelime kartları, gramer, Lesen/Hören alıştırmaları, AI yazma değerlendirmesi, sesli pratik, süreli deneme sınavı, ilerleme grafikleri, XP/rozet, uygulama içi bildirimler, ayarlar, yönetim paneli (davet, arama/filtre, görev atama, hedef belirleme, hesap devre dışı bırakma).

Sınırlar:
- **Soru bankası küçük** (32 havuz + 27 ders + 12 gramer sorusu, 63 kelime). Özgündür, resmî Goethe materyali değildir. `supabase/migrations/0004_seed_content.sql` benzeri dosyalarla genişlet.
- **Hören** ses kayıtları tarayıcının Almanca TTS sesidir (stüdyo kaydı değil).
- **Sprechen** tarayıcı SpeechRecognition + sunucu AI yanıtı + TTS ile tur bazlı çalışır (Chrome/Edge). Gerçek zamanlı Gemini Live akışı yok; telaffuz puanı tarayıcının tanıma güvenidir.
- Bildirimler uygulama içidir; e-posta/push hatırlatma altyapısı yok.
- Sınav süresi istemcide sayılır, sunucu başlangıç/bitiş zamanını kaydeder ve gecikmeyi `late` olarak işaretler.
- Playwright E2E testleri yok; birim testleri `tests/` içindedir.

## AI bağlantısını canlı doğrulama

Yönetici hesabıyla `/admin/ai` sayfasına gir. Önce Gemini veya OpenAI sağlayıcısını, model adını ve API anahtarını kaydet. Ardından **Gerçek AI bağlantısını test et** düğmesi, seçili sağlayıcıya sunucu üzerinden gerçek bir istek gönderir. Başarılı yanıt ve gecikme süresi gösterilir; anahtar hiçbir zaman tarayıcıya geri gönderilmez.

Öğrenci tarafındaki sohbet, seviye tespiti, kişisel plan, yazma değerlendirmesi ve sesli rol canlandırma aynı sunucu tarafı AI sağlayıcı ayarını kullanır. Sesli rol canlandırma tarayıcının konuşma tanıma özelliğiyle sesi metne çevirir, metni AI'ya gönderir ve yanıtı tarayıcıda seslendirir; bu sürüm sürekli açık, düşük gecikmeli Gemini Live/WebSocket oturumu değildir.
