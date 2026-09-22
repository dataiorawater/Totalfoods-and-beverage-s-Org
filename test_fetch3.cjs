async function run() {
  const res = await fetch("https://script.google.com/macros/s/AKfycbzfqWujgz3EhJJ4fJ6DEf6J6RibJvyp_b8QA2OwVAhN1WG4gVEr2OnrOXtqvJnJqMU9/exec", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "test", event: 'order_notification' }),
    signal: AbortSignal.timeout(8000),
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
