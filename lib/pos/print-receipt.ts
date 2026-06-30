/** Trigger thermal receipt print using the hidden #receipt-to-print element. */
export function printReceiptElement(): void {
  const receiptElement = document.getElementById('receipt-to-print');

  if (receiptElement) {
    receiptElement.style.visibility = 'visible';
    receiptElement.style.display = 'block';
    receiptElement.style.position = 'relative';

    let parent = receiptElement.parentElement;
    while (parent && parent !== document.body) {
      parent.style.visibility = 'visible';
      parent.style.display = 'block';
      parent = parent.parentElement;
    }

    window.print();
    return;
  }

  window.print();
}
