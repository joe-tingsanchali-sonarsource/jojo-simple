// Global pollution
var globalCount = 0;
function update() { ... } 

// Formatting problems + magic numbers
function doSomething(data) {
for(let i=0;i < data.length; i++) {
  if (data[i] > 25) {
    // ... some logic
  } 
}}

// Complex function, nesting, DOM issues
function processAndDisplay(input) {
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] % 2 === 0) {
      // More calculations
      for (let j = 0; j < 5; j++) { result += j * 2; } 
    } 
  }
  document.getElementById('resultArea').innerHTML = result + input; 
}

var x = 10; // Potentially global scope pollution

function calculateTotal(items) {
  var total = 0; 
  for (var i = 0; i < items.length; i++) { 
    total += items[i].price;
  }
  return total; 
}

// ... elsewhere, maybe x is used unexpectedly

function compareValues(value1, value2) {
  if (value1 == value2) { // Loose comparison (type coercion)
    console.log("Values are equal");
  } else {
    console.log("Values are different");
  }
}

compareValues(5, "5"); // Outcome: "Values are equal"


// Security vulnerabilities
function calculate(expr) {
  return eval(expr); 
}
function search(name) {
  db.query("SELECT * FROM users WHERE username = '" + name + "'");
}

document.getElementById("myButton").onclick = function() {
  const inputText = document.getElementById("userInput").value;
  document.getElementById("output").innerHTML = inputText; 
  // ... no cleanup of the event listener
};


// Unused code
var oldVariable = 10; 



function fetchData() {
  fetch("https://api.example.com/data") 
    .then(response => response.json())
    .then(data => console.log(data)); 
}

fetchData();
console.log("This might execute before the data is fetched!");

function isValidEmail(email) {
  const complexRegex = /^(.*)@(.+)\.([a-z]{2,})$/i; 
  return complexRegex.test(email);
}


// function notUsedAnywhere() { ... }
