async function test() {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYlkaqgQ5ytxz_5tDxNAss69KbEzz7hnvZmSISUHZ0baAZcEhz4sFqPHj8QDU_2zI/exec';
  const url = `${SCRIPT_URL}?ticker=LAME4`;
  const response = await fetch(url);
  const data = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", data.substring(0, 500));
}
test();
