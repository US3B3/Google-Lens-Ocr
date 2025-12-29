
# Gemini Lens OCR

Akıllı, Gemini destekli OCR ve doküman düzenleyici.

## Kurulum

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. API Anahtarınızı ayarlayın:
   `.env` dosyası oluşturun ve Gemini API anahtarınızı ekleyin:
   ```env
   VITE_API_KEY=your_gemini_api_key_here
   ```

3. Uygulamayı başlatın:
   ```bash
   npm run dev
   ```

## Özellikler
- **Görsel & PDF Desteği**: Tekli veya çok sayfalı doküman tarama.
- **Klasör Tarama**: Bir klasör dolusu dökümanı tek bir metin dosyasına dönüştürün.
- **Akıllı Düzenleyici**: Gemini tarafından düzeltilen metinleri manuel olarak düzenleyin.
- **TXT Dışa Aktar**: Sonuçları cihazınıza .txt olarak indirin.
