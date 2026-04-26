import fetch from "node-fetch";

async function run() {
  const url1 = `http://localhost:3000/api/football/fixtures?date=2024-05-15`;
  const res1 = await fetch(url1);
  const data1 = await res1.json();
  const ids = data1.response.slice(0, 2).map(f => f.fixture.id).join("-");
  
  const url2 = `http://localhost:3000/api/football/fixtures?ids=${ids}`;
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  if (data2.response && data2.response.length > 0) {
    console.log("Includes events?", !!data2.response[0].events);
    console.log("Keys:", Object.keys(data2.response[0]));
  } else {
    console.log("No data");
  }
}
run();
