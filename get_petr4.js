const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYlkaqgQ5ytxz_5tDxNAss69KbEzz7hnvZmSISUHZ0baAZcEhz4sFqPHj8QDU_2zI/exec";
(async () => {
    let r = await fetch(`${SCRIPT_URL}?ticker=BVMF:PETR4`).then(r => r.json());
    console.log(r);
})();
