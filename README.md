# RawPrint9100

**Ağ üzerinden TCP/9100 portuna ham veri yazdırmak için browser tabanlı test aracı.**  
Windows Spooler, sürücü veya CUPS gerektirmez.

![RawPrint9100](https://img.shields.io/badge/TCP-9100%20RAW-00e5c8?style=flat-square)
![ESC/POS](https://img.shields.io/badge/ESC%2FPOS-destekli-3ddc84?style=flat-square)
![PostScript](https://img.shields.io/badge/PostScript-destekli-ff8c69?style=flat-square)
![PCL](https://img.shields.io/badge/PCL5-destekli-f5a623?style=flat-square)

## Mimari

```
Browser (HTML5/JS)
    │  WebSocket
    ▼
server.js (Node.js)   ← sadece bu makineye kurulur
    │  TCP:9100
    ▼
Ağ Yazıcısı
```

Tarayıcılar güvenlik kısıtları nedeniyle doğrudan raw TCP soketi açamaz.  
`server.js`, WebSocket mesajlarını yazıcıya TCP/9100 üzerinden ileten minimal bir köprüdür.

## Kurulum

```bash
git clone https://github.com/unicasoft/RawPrint9100.git
cd RawPrint9100
npm install
npm start
```

Tarayıcıda açın: **http://localhost:9191**

## Özellikler

| Şablon | Açıklama |
|--------|----------|
| **Düz Metin** | UTF-8 / Latin-1 ham metin yazdırma |
| **ESC/POS — Init + Test** | Yazıcı reset, bold, underline, align, çift boy metin |
| **ESC/POS — Durum Sorgula** | `DLE EOT` ile gerçek zamanlı yazıcı durum sorgusu |
| **ESC/POS — Barkod + QR** | CODE128 barkod ve QR kod oluşturma |
| **PostScript** | `%!PS` dil testi, renkli kutular, çizgi kalınlıkları |
| **PCL 5** | HP PCL5 escape dizisi testi |
| **Ham HEX** | Boşlukla ayrılmış hex bayt girişi (`1B 40 48 65 6C...`) |

### Ek Özellikler

- ⚡ **Ping (TCP Knock):** Yazıcı portuna bağlanabilirliği test eder  
- 🔤 **Kodlama Seçimi:** UTF-8, Latin-1, HEX, Base64  
- 🔍 **HEX Görünüm:** Editördeki metni bayt bazında incele  
- 📋 **İşlem Günlüğü:** Zaman damgalı, renk kodlu; TXT olarak dışa aktar  
- ⌨️ `Ctrl+Enter` → Gönder | `Ctrl+L` → Günlüğü Temizle  

## Yapılandırma

```bash
PORT=9191 node server.js          # varsayılan port
PORT=8080 node server.js          # farklı port
node server.js --dev              # geliştirme modu
```

## Protokol Referansları

- **ESC/POS:** Epson ESC/POS Command Reference  
- **PostScript:** Adobe PLRM (PostScript Language Reference Manual)  
- **PCL 5:** HP PCL 5 Printer Language Technical Reference  
- **TCP/9100:** IEEE 1284.4 / AppSocket / JetDirect RAW  

## Lisans

MIT © UniCaSoft
