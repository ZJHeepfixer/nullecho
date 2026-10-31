// The "vendor" price-test script of harness/fixtures/price-control.html: puts the shopper in the 15.00 group by
// rewriting the rendered price AND the declared one, as client-side price tests do. Blocked, the page stays at 20.00.
(() => {
  const price = document.getElementById('price');
  if (price) price.textContent = '$15.00';
  const ld = document.getElementById('ld');
  if (ld) {
    const data = JSON.parse(ld.textContent);
    data.offers.price = '15.00';
    ld.textContent = JSON.stringify(data);
  }
})();
