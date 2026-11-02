# DeutschAI — Bu sürümde yapılanlar

## Güncellemeler

- Yönetim paneline `/admin/ai` sayfası eklendi. Yönetici Gemini veya OpenAI sağlayıcısını, model adını ve API anahtarını buradan tanımlayabilir.
- Panelden girilen AI anahtarları AES-256-GCM ile şifrelenerek Supabase'te saklanır. API anahtarı hiçbir zaman istemciye geri gönderilmez.
- `APP_ENCRYPTION_KEY` sunucu ortam değişkeni eklendi. 64 karakterlik hex anahtar üretme komutu `.env.example` ve README içindedir.
- `0005_secure_ai_settings.sql` migration'ı eklendi; `setup.sql` yeni tabloyu da oluşturacak şekilde güncellendi.
- Öğrenme planı, ses oturumu ve yazma gönderimi tablolarında doğrudan öğrenci INSERT izinleri kaldırıldı. Bu kayıtlar sunucu tarafında service-role ile yazılır.
- Ses ve yazma API'leri kayıtları service-role üzerinden yazacak şekilde güncellendi.
- Yönetici sayfaları ve davet endpoint'i aktif hesap + yönetici rolü kontrolünü ortak sunucu kontrolünden geçirir.
- Kurulum ve güvenlik açıklamaları README'de güncellendi.

## Kontroller

- 81 TypeScript/TSX dosyasında sözdizimi kontrolü: 0 tanı.
- Yerleştirme soru havuzu, cevap puanlama ve aralıklı tekrar mantığı için smoke testleri: başarılı.
- AES-256-GCM şifreleme/çözme ve bozulmuş şifreli metin testi: başarılı.
- `npm ci` bu çalışma ortamında npm registry erişimi zaman aşımına uğradığı için tamamlanamadı. Bu nedenle `npm test` ve `npm run build` tam olarak çalıştırılamadı. Vercel'e yüklemeden önce yerel ortamda bu iki komutu çalıştır.

## Bilinen sınırlamalar / yayın öncesi işler

- Proje lock dosyasında Next.js 15.5.28 kullanıyor. Bu, 15.x bakım dalının yamalı sürümüdür; Next.js 16 aktif LTS dalına geçiş ayrıca yapılmalı ve build ile doğrulanmalıdır.
- Sesli pratik gerçek zamanlı Gemini Live değildir; tarayıcı SpeechRecognition + sunucu üzerinden tur bazlı AI yanıtı + TTS kullanır.
- Soru bankası başlangıç için sınırlıdır: 32 yerleştirme havuzu sorusu, 27 ders sorusu, 12 gramer sorusu ve 63 kelime.
- Playwright uçtan uca testleri yoktur.
- Gerçek Supabase/Vercel ortamı, e-posta şablonları, yönlendirme URL'leri ve API anahtarları bu ortamdan doğrulanamaz; README sırasıyla kurulmalıdır.
