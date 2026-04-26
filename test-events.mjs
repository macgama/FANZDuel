import fetch from "node-fetch";

async function run() {
  const url = `http://localhost:3000/api/football/fixtures?date=2024-05-15`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.response && data.response.length > 0) {
    console.log("Includes events?", !!data.response[0].events);
    console.log("Keys:", Object.keys(data.response[0]));
  } else {
    console.log("No data");
  }
}
run();
