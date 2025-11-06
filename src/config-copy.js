var content = "6a2f41a3-c54c-fce8-32d2-0324e1c32e22";

// var content = "6a2f41a3-c54c-fce8-32d2-0324e1c32e22";

//REVIEW
//REVIEW


// 1. Cross-Site Scripting (XSS)
function displayMessage(userInput) {
  document.getElementById("output").innerHTML = userInput;
}

// 2. SQL Injection
function searchProduct(productId) {
  var query = "SELECT * FROM products WHERE id = '" + productId + "'";
  // ... execute database query ... 
}

// 3. Regular Expression Denial of Service (ReDoS)
function validateEmail(email) {
  var complexRegex = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
  return complexRegex.test(email);
} 

// 4. Using 'eval' with unsanitized input
function calculate(expression) {
  var result = eval(expression); 
  return result;
}
