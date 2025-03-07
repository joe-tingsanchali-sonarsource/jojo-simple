<?php

// 1. Unused Variable Bug
$unusedVar = "I'm not used anywhere";
$message = "Hello World!";
echo $message . PHP_EOL;

// 2. Unreachable Code Bug
function foo() {
    return;
    echo "This code is not reachable";
}
foo();

// 3. Incorrect Loop Condition Bug
for ($i = 0; $i <= 10; $i--) {
    echo $i . PHP_EOL;
    if ($i === -10) break;
}

// 4. Inconsistent Return Values Bug
function getValue($condition) {
    if ($condition) {
        return true;
    }
    return null;
}
echo var_export(getValue(false), true) . PHP_EOL; // Output: null

// 5. Equality Operator Bug
$x = "5";
if ($x == 5) {
    echo "Equal" . PHP_EOL;
}
if ($x === 5) {
    echo "Also Equal" . PHP_EOL;
}

// 6. Accidental Global Variable Bug
function bar() {
    global $globalVar;
    $globalVar = "Oops, I'm global";
}
bar();
echo $globalVar . PHP_EOL; // Output: Oops, I'm global

// 7. Incorrect Function Usage Bug
function multiply($a, $b = 1) {
    return $a * $b;
}
echo multiply(5) . PHP_EOL; // Output: 5

// 8. Type Coercion Problem
$a = 1;
$b = "2";
echo $a + (int)$b . PHP_EOL; // Output: 3

// 9. Misleading Comments
// This function adds two numbers
