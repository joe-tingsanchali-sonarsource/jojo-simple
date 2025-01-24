var content = "6a2f41a3-c54c-fce8-32d2-0324e1c32e22";

// var content = "6a2f41a3-c54c-fce8-32d2-0324e1c32e22";

REVIEW
//REVIEW

function whoCalled() {
   if (arguments.caller == null)   //Noncompliant
      console.log('I was called from the global scope.');
   else
      console.log(arguments.caller + ' called me!');  // Noncompliant

  console.log(whoCalled.caller);  // Noncompliant
  console.log(whoCalled.arguments);  // Noncompliant
}