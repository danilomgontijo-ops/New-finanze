async function test() {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYlkaqgQ5ytxz_5tDxNAss69KbEzz7hnvZmSISUHZ0baAZcEhz4sFqPHj8QDU_2zI/exec';
  const url1 = `${SCRIPT_URL}?ticker=ITUB3`;
  const url2 = `${SCRIPT_URL}?ticker=BVMF:ITUB3`;
  console.log("ITUB3:", (await (await fetch(url1)).text()).substring(0, 100));
  console.log("BVMF:ITUB3:", (await (await fetch(url2)).text()).substring(0, 100));
}
test();
