# Hardware Integration Guide: Barcode Scanners & Receipt Printers

This guide explains how to integrate barcode scanners and receipt printers with your POS system.

---

## Table of Contents

1. [Barcode Scanner Integration](#barcode-scanner-integration)
   - [Option 1: USB/HID Scanners (Recommended)](#option-1-usbhid-scanners-recommended)
   - [Option 2: Bluetooth Scanners](#option-2-bluetooth-scanners)
   - [Option 3: Camera-Based Scanning](#option-3-camera-based-scanning)
   - [Implementation Steps](#implementation-steps-barcode)
2. [Receipt Printer Integration](#receipt-printer-integration)
   - [Option 1: Browser Print (Simple)](#option-1-browser-print-simple)
   - [Option 2: ESC/POS Thermal Printers](#option-2-escpos-thermal-printers)
   - [Option 3: Network Printers](#option-3-network-printers)
   - [Implementation Steps](#implementation-steps-printer)
3. [Recommended Hardware](#recommended-hardware)
4. [Testing](#testing)

---

## Barcode Scanner Integration

Your POS system already supports barcodes - items have a `barcode` field in the database. The scanner integration connects this to the checkout process.

### Option 1: USB/HID Scanners (Recommended)

**How it works:** USB barcode scanners act as keyboard devices. When you scan a barcode, the scanner "types" the barcode number followed by Enter. This is the easiest integration method.

**Recommended Scanners:**
- Honeywell Voyager 1200g (~$50-80)
- Symbol LS2208 (~$40-60)
- Netum NT-1228BL (~$20-30)

**Pros:**
- Plug and play - no drivers needed
- Works with any device with USB port
- No code changes required for basic functionality

**Cons:**
- Requires USB port
- Less portable than Bluetooth

**Setup:**
1. Plug the scanner into your computer/tablet via USB
2. The scanner will be recognized as a keyboard
3. Focus on the search/product input field
4. Scan a barcode - it will be typed automatically

### Option 2: Bluetooth Scanners

**How it works:** Bluetooth scanners pair with your device and also act as keyboard devices, typing the scanned barcode.

**Recommended Scanners:**
- Tera HW0002 (~$30-50)
- Symcode MJ-2877 (~$25-40)
- Eyoyo EY-002S (~$20-35)

**Pros:**
- Wireless, more portable
- Works with tablets and phones
- Same keyboard emulation as USB

**Cons:**
- Requires Bluetooth pairing
- Battery management needed

**Setup:**
1. Put scanner in pairing mode (check scanner manual)
2. Pair with your device via Bluetooth settings
3. Scanner will act as a Bluetooth keyboard
4. Focus on search field and scan

### Option 3: Camera-Based Scanning

**How it works:** Uses the device's camera to scan barcodes. Best for mobile devices without external scanners.

**Libraries to use:**
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) - Supports barcodes and QR codes
- [quagga2](https://github.com/ericblade/quagga2) - Barcode-only, very accurate
- [@zxing/browser](https://github.com/nickmomrik/zxing-js) - Multi-format support

**Pros:**
- No additional hardware needed
- Works on any device with a camera
- Good for mobile/tablet POS

**Cons:**
- Slower than dedicated scanners
- Requires good lighting
- Camera permission needed

---

### Implementation Steps (Barcode)

#### Step 1: Create Barcode Scanner Hook

Create a new file `lib/hooks/use-barcode-scanner.ts`:

```typescript
'use client';

import { useEffect, useCallback, useRef } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const currentTime = Date.now();
    
    // If more than 50ms since last key, reset buffer (human typing is slower)
    if (currentTime - lastKeyTimeRef.current > 50) {
      bufferRef.current = '';
    }
    lastKeyTimeRef.current = currentTime;

    // Enter key = end of barcode
    if (event.key === 'Enter') {
      if (bufferRef.current.length >= 4) { // Minimum barcode length
        event.preventDefault();
        onScan(bufferRef.current);
      }
      bufferRef.current = '';
      return;
    }

    // Only accept alphanumeric characters
    if (/^[a-zA-Z0-9]$/.test(event.key)) {
      bufferRef.current += event.key;
    }
  }, [onScan, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    clearBuffer: () => { bufferRef.current = ''; }
  };
}
```

#### Step 2: Create Barcode Lookup API

Create `app/api/items/barcode/[code]/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import type { Item } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const { code } = await params;

    if (!code) {
      return jsonResponse(
        { success: false, message: 'Barcode is required' },
        400
      );
    }

    const item = await queryOne<Item>(
      `SELECT * FROM items 
       WHERE business_id = ? AND barcode = ? AND active = 1`,
      [auth.businessId, code]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Product not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to lookup barcode',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
```

#### Step 3: Integrate with POS Page

Update `app/pos/page.tsx` to handle barcode scans:

```typescript
// Add to imports
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';

// Inside the component
const handleBarcodeScan = async (barcode: string) => {
  try {
    const result = await apiGet<Item>(`/api/items/barcode/${barcode}`);
    
    if (result.success && result.data) {
      // Add item to cart or open quantity dialog
      // Use your existing addToCart logic
      addToCart({
        itemId: result.data.id,
        name: result.data.name,
        price: result.data.current_sell_price,
        quantity: 1,
        unitType: result.data.unit_type,
      });
      
      // Optional: Play a beep sound
      new Audio('/sounds/beep.mp3').play().catch(() => {});
    } else {
      // Show error notification
      alert(`Product not found: ${barcode}`);
    }
  } catch (error) {
    console.error('Barcode scan error:', error);
  }
};

useBarcodeScanner({
  onScan: handleBarcodeScan,
  enabled: true, // Disable during dialogs/modals
});
```

#### Step 4: Camera-Based Scanning (Optional)

Install the library:

```bash
npm install html5-qrcode
```

Create a camera scanner component `components/pos/CameraScanner.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('camera-scanner');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
      },
      (decodedText) => {
        onScan(decodedText);
        scanner.stop();
        onClose();
      },
      () => {} // Ignore errors during scanning
    ).catch((err) => {
      setError('Camera access denied or not available');
      console.error('Camera error:', err);
    });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan Barcode</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {error ? (
          <p className="text-destructive text-center py-8">{error}</p>
        ) : (
          <div id="camera-scanner" className="rounded overflow-hidden" />
        )}
        
        <p className="text-sm text-muted-foreground text-center mt-4">
          Point camera at barcode
        </p>
      </div>
    </div>
  );
}
```

---

## Receipt Printer Integration

### Option 1: Browser Print (Simple)

**How it works:** Uses the browser's built-in print functionality with CSS optimized for receipts.

**Current Implementation:** Your `Receipt.tsx` component already supports browser printing with `print:` CSS classes.

**To print:**
```typescript
window.print();
```

**Pros:**
- No additional setup required
- Works on any device
- Already implemented in your codebase

**Cons:**
- Opens print dialog every time
- Less control over formatting
- Not ideal for high-volume operations

**Improving the current Receipt component:**

Add a print button to your receipt page:

```typescript
<Button onClick={() => window.print()}>
  Print Receipt
</Button>
```

Add these print styles to `app/globals.css`:

```css
@media print {
  /* Hide everything except receipt */
  body * {
    visibility: hidden;
  }
  
  .receipt-container,
  .receipt-container * {
    visibility: visible;
  }
  
  .receipt-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm; /* Standard thermal receipt width */
  }
  
  /* Hide navigation, buttons, etc */
  nav, button, .no-print {
    display: none !important;
  }
}
```

### Option 2: ESC/POS Thermal Printers

**How it works:** Thermal receipt printers use the ESC/POS command language. You need a print server or direct connection.

**Recommended Printers:**
- Epson TM-T20III (~$180-220) - Industry standard
- Star TSP143III (~$200-250) - Reliable
- MUNBYN ITPP047 (~$80-120) - Budget option
- Xprinter XP-58IIH (~$30-50) - Very budget

**Connection Methods:**

1. **USB Direct** - Requires a local print server
2. **Network/Ethernet** - Printer has IP address
3. **Bluetooth** - For mobile setups
4. **Serial/RS-232** - Legacy systems

### Option 3: Network Printers

**How it works:** Printer connects to your network and receives print commands via HTTP or raw socket.

**Architecture:**

```
[POS Web App] → [Print Server/API] → [Network Printer]
```

---

### Implementation Steps (Printer)

#### Step 1: Install ESC/POS Library

```bash
npm install escpos escpos-usb escpos-network
```

Or for a pure JavaScript solution:

```bash
npm install receipt-printer-encoder
```

#### Step 2: Create Print Server (Node.js)

For production, you'll need a local print server. Create `print-server/server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
// OR for network: escpos.Network = require('escpos-network');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/print', async (req, res) => {
  try {
    const { receipt } = req.body;
    
    // USB Printer
    const device = new escpos.USB();
    // OR Network: const device = new escpos.Network('192.168.1.100');
    
    const printer = new escpos.Printer(device);
    
    device.open((err) => {
      if (err) {
        return res.status(500).json({ error: 'Printer not connected' });
      }
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text(receipt.businessName)
        .style('normal')
        .text('------------------------')
        .align('lt');
      
      // Print items
      receipt.items.forEach(item => {
        printer
          .text(`${item.name}`)
          .text(`  ${item.quantity} x ${item.price} = ${item.total}`);
      });
      
      printer
        .text('------------------------')
        .align('rt')
        .style('b')
        .text(`TOTAL: KES ${receipt.total}`)
        .style('normal')
        .align('ct')
        .text('')
        .text('Thank you for shopping!')
        .text(new Date().toLocaleString())
        .cut()
        .close();
      
      res.json({ success: true });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Print server running on port 3001');
});
```

**Run the print server:**

```bash
node print-server/server.js
```

#### Step 3: Create Print Service in Your App

Create `lib/services/print-service.ts`:

```typescript
interface ReceiptData {
  businessName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  total: number;
  paymentMethod: string;
  date: Date;
  saleId: string;
}

const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';

export async function printReceipt(receipt: ReceiptData): Promise<boolean> {
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt }),
    });
    
    if (!response.ok) {
      throw new Error('Print failed');
    }
    
    return true;
  } catch (error) {
    console.error('Print error:', error);
    
    // Fallback to browser print
    window.print();
    return false;
  }
}
```

#### Step 4: Add Print Button to Receipt Page

Update `app/pos/receipt/[id]/page.tsx`:

```typescript
import { printReceipt } from '@/lib/services/print-service';

// In your component
const handlePrint = async () => {
  const success = await printReceipt({
    businessName: sale.business_name || 'Store',
    items: items.map(item => ({
      name: item.item_name,
      quantity: item.quantity_sold,
      price: item.sell_price_per_unit,
      total: item.quantity_sold * item.sell_price_per_unit,
    })),
    total: sale.total_amount,
    paymentMethod: sale.payment_method,
    date: new Date(sale.sale_date * 1000),
    saleId: sale.id,
  });
  
  if (success) {
    // Show success notification
  }
};

// Add button
<Button onClick={handlePrint}>
  <Printer className="mr-2 h-4 w-4" />
  Print Receipt
</Button>
```

#### Step 5: Auto-Print After Sale (Optional)

In your checkout completion handler:

```typescript
// After sale is complete
if (settings.autoPrintReceipt) {
  await printReceipt(receiptData);
}
```

---

## Recommended Hardware

### Budget Setup (~$50-100)
| Item | Model | Price |
|------|-------|-------|
| Barcode Scanner | Netum NT-1228BL (USB) | ~$25 |
| Receipt Printer | Xprinter XP-58IIH (USB) | ~$35 |
| **Total** | | **~$60** |

### Mid-Range Setup (~$150-250)
| Item | Model | Price |
|------|-------|-------|
| Barcode Scanner | Honeywell Voyager 1200g | ~$70 |
| Receipt Printer | MUNBYN ITPP047 (USB/Network) | ~$100 |
| **Total** | | **~$170** |

### Professional Setup (~$300-500)
| Item | Model | Price |
|------|-------|-------|
| Barcode Scanner | Symbol LS2208 + Stand | ~$80 |
| Receipt Printer | Epson TM-T20III (Network) | ~$220 |
| Cash Drawer | MUNBYN 16" (Printer-driven) | ~$50 |
| **Total** | | **~$350** |

---

## Testing

### Testing Barcode Scanner

1. **Add test barcodes to items:**
   - Go to Admin → Items
   - Edit an item and add a barcode (e.g., "1234567890123")
   
2. **Test keyboard emulation:**
   - Open browser console
   - Type the barcode quickly and press Enter
   - The barcode scanner hook should detect it

3. **Test with real scanner:**
   - Plug in USB scanner
   - Focus on POS page
   - Scan a product barcode
   - Item should be added to cart

### Testing Receipt Printer

1. **Test browser print:**
   - Complete a sale
   - On receipt page, press Ctrl+P (or Cmd+P)
   - Check preview formatting

2. **Test print server:**
   ```bash
   # Start print server
   node print-server/server.js
   
   # Test endpoint
   curl -X POST http://localhost:3001/print \
     -H "Content-Type: application/json" \
     -d '{"receipt":{"businessName":"Test","items":[],"total":100}}'
   ```

3. **Test from app:**
   - Complete a sale
   - Click "Print Receipt"
   - Receipt should print automatically

---

## Troubleshooting

### Barcode Scanner Issues

| Problem | Solution |
|---------|----------|
| Scanner not detected | Check USB connection, try different port |
| Wrong characters typed | Check scanner encoding settings (usually Code 128) |
| Scans too slow | Lower the scan delay threshold in hook |
| Bluetooth not pairing | Reset scanner, check device Bluetooth |

### Receipt Printer Issues

| Problem | Solution |
|---------|----------|
| Printer not found | Check USB/network connection |
| Garbled output | Check printer encoding (UTF-8) |
| Paper not feeding | Check paper roll direction |
| Cuts not working | Enable cutter in printer settings |
| Network printer offline | Check IP address, ping printer |

---

## Environment Variables

Add these to your `.env` file:

```env
# Print Server URL (for thermal printer)
NEXT_PUBLIC_PRINT_SERVER_URL=http://localhost:3001

# Auto-print settings
NEXT_PUBLIC_AUTO_PRINT_RECEIPT=false
```

---

## Next Steps

1. **Purchase hardware** based on your budget and needs
2. **Set up barcode scanner** - usually plug-and-play
3. **Add barcodes to products** in admin panel
4. **Install print server** if using thermal printer
5. **Configure auto-print** settings if desired
6. **Test thoroughly** before going live

For questions or issues, refer to the hardware manufacturer's documentation or create an issue in the project repository.
