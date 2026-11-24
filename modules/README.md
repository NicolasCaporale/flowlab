# Modules

The module library of FlowLab, divided by topic. A module is a normal `.fprg` program:
its classes or functions are imported into another program (button «Import module») and used like those
written by hand, but they stay read-only. The Main of the module is only for testing it and is not imported.
Anyone can write a module, even a student: it is enough to save a program with the classes to reuse.

| Topic | Module | Classes or functions | Description |
|---|---|---|---|
| Data structures | [ArrayList](data_structures/ArrayList.fprg) | `ArrayList<T>` | List of items of type T that grows by itself, like java.util.ArrayList. Internally it uses an array: when it is full it creates one one and a half times bigger and copies the items. A position outside the list throws IndexOutOfRange, a negative capacity InvalidArgument, as in Java. |
| Data structures | [Stack](data_structures/Stack.fprg) | `Stack<T>` | Stack (LIFO) of items of type T, like java.util.Stack: the last item inserted with push is the first removed with pop. It uses an array that grows when it is full. pop and peek on an empty stack throw EmptyStack, as in Java. |
| Data structures | [Queue](data_structures/Queue.fprg) | `Queue<T>`, `Node<T>` | Queue (FIFO) of items of type T, like java.util.Queue: the items leave in the order they entered. It is a linked list of Node<T> nodes. remove and peek on an empty queue throw NoSuchElement, as remove() and element() in Java. |
| Sorting algorithms | [Sorting](sorting_algorithms/Sorting.fprg) | `bubbleSort()`, `selectionSort()`, `insertionSort()` | Functions to sort an array of integers in increasing order: bubbleSort(v, n), selectionSort(v, n) and insertionSort(v, n), where n is the number of items to sort. |
| Searching algorithms | [Search](searching_algorithms/Search.fprg) | `linearSearch()`, `binarySearch()` | Functions to search for a value x in an array of integers: linearSearch(v, n, x) for any array and binarySearch(v, n, x) for a sorted array. They return the position of the value or -1 if it is not there. |
| Strings | [Strings](strings/Strings.fprg) | `Substring()`, `IndexOf()`, `Contains()`, `StartsWith()`, `EndsWith()`, `ToUpper()`, `ToLower()`, `Trim()`, `Replace()`, `Split()`, `IsDigit()`, `IsLetter()` | Functions on strings, like the methods of String in Java: Substring(s, beginIndex, endIndex), IndexOf, Contains, StartsWith, EndsWith, ToUpper, ToLower, Trim, Replace, Split (an array of strings) and IsDigit, IsLetter for a character. Positions start from 0. In the generated code they become the functions of each language. |

In the generated code the library modules that have an equivalent in the language use the classes
already available (for example `java.util.ArrayList`, `list` in Python, `std::vector` in C++), and the
functions of Strings become those of each language (`s.substring(a, b)` in Java, `s[a:b]` in Python); the other
modules become classes or functions written in the code.

Each subfolder is a topic: its name, with spaces written as `_`, is the one shown in FlowLab
(`data_structures` becomes «Data structures»). The description of each module is the one written in
Program properties › Description. In FlowLab other module collections can be added: the GitHub link
of a folder organised the same way is enough.

This folder is regenerated with `node tools/modules.js`.
