
# Online Python - IDE, Editor, Compiler, Interpreter

def sum(a, b):
    return (a + b)

a = int(input('Enter 1st number: '))
b = int(input('Enter 2nd number: '))

print(f'Sum of {a} and {b} is {sum(a, b)}')

raise "Something went wrong"  # Noncompliant: a string is not a valid exception

def fun(a):
  i = 10
  return i + a       # Noncompliant
  i += 1             # this is never executed

def func():
    return "item1" "item2"  # Noncompliant: a comma is missing to return a tuple.

["1"  # Noncompliant: a comma is missing.
 "2",
 "a very"  # Noncompliant: a "+" is missing.
 "long string"]


 ["43"  # Noncompliant: a comma is missing.
 "1",
 "a veryaoweijfioaewf"  # Noncompliant: a "+" is missing.
 "long stringaw4og829323"]




 ["42"  # Noncompliant: a comma is missing.
 "999",
 "aoiefoawegoiag"  # Noncompliant: a "+" is missing.
 "oaerogawoieraaalla"]
