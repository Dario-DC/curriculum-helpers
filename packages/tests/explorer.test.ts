import { Explorer } from "../helpers/lib/class/explorer";

expect.extend({
  toMatchExplorer(received: Explorer, expected: string) {
    const pass = received.matches(expected);
    return {
      message: () =>
        pass
          ? `Expected ${received.toString()} not to match ${expected}`
          : `Expected ${received.toString()} to match ${expected}`,
      pass,
    };
  },
});

describe("isEmpty", () => {
  it("returns true for an empty Explorer", () => {
    const explorer = new Explorer();
    expect(explorer.isEmpty()).toBe(true);
  });

  it("returns false for a non-empty Explorer", () => {
    const explorer = new Explorer("const a = 1;");
    expect(explorer.isEmpty()).toBe(false);
  });
});

describe("toString", () => {
  it("returns 'no ast' for an empty Explorer", () => {
    const explorer = new Explorer();
    expect(explorer.toString()).toBe("no ast");
  });

  it("returns the source code for a non-empty Explorer", () => {
    const sourceCode1 = "const a = 1;";
    const explorer = new Explorer(sourceCode1);
    expect(explorer.toString()).toBe(sourceCode1);

    const sourceCode2 = "function foo() { return 42; }";
    const explorer2 = new Explorer(sourceCode2);
    expect(explorer2.toString()).toBe(sourceCode2);
  });
});

describe("equals", () => {
  it("returns true when comparing equivalent nodes", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a = 1;")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo() { return 42; }")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x: number; }")).toBe(true);
  });

  it("returns false when comparing non-equivalent nodes", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const b = 2;")).toBe(false);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function bar() { return 42; }")).toBe(false);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Baz { x: number; }")).toBe(false);
  });

  it("ignores irrelevant whitespace", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a =  1;")).toBe(true);
    expect(explorer1.matches("const  a = 1; ")).toBe(true);
    expect(explorer1.matches(" const a = 1;")).toBe(true);
    expect(explorer1.matches(" const a=1; ")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo( ) { return 42; }")).toBe(true);
    expect(explorer2.matches("function foo () { return 42; } ")).toBe(true);
    expect(explorer2.matches(" function foo() { return 42; }")).toBe(true);
    expect(explorer2.matches(" function foo() { return 42; } ")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x:number; }")).toBe(true);
    expect(explorer3.matches("interface Bar { x:  number; } ")).toBe(true);
    expect(explorer3.matches(" interface Bar  { x: number; }")).toBe(true);
    expect(explorer3.matches(" interface Bar { x: number; } ")).toBe(true);
  });

  it("ignores trailing semicolons", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a = 1")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo() { return 42 }")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x: number }")).toBe(true);
  });
});

describe("variables", () => {
  describe("findVariables", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.findVariables();
      variables.forEach((v) => expect(v).toBeInstanceOf(Explorer));
    });

    it("returns one entry per variable", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.findVariables();
      expect(variables).toHaveLength(2);
    });

    it("returns an empty array if there are no variables", () => {
      const sourceCode = "function foo() { return 42; }";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.findVariables();
      expect(variables).toHaveLength(0);
    });

    it("finds all variables in the current scope", () => {
      const sourceCode = `
                    const a = 1;
                    const bar = () => 42;
                    let baz;
                    function foo() { const b = 2; };
                `;
      const explorer = new Explorer(sourceCode);
      const variables = explorer.findVariables();
      expect(variables).toHaveLength(3);
      expect(variables[0].matches("const a = 1;")).toBe(true);
      expect(variables[1].matches("const bar = () => 42;")).toBe(true);
      expect(variables[2].matches("let baz;")).toBe(true);
    });
  });

  describe("findVariable", () => {
    it("returns an Explorer object for the specified variable name", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variableA = explorer.findVariable("a");
      expect(variableA).toBeInstanceOf(Explorer);
      expect(variableA.matches("const a = 1;")).toBe(true);

      const variableB = explorer.findVariable("b");
      expect(variableB).toBeInstanceOf(Explorer);
      expect(variableB.matches("const b = 2;")).toBe(true);
    });

    it("returns an empty Explorer object if the specified variable name is not found", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variableC = explorer.findVariable("c");
      expect(variableC).toBeInstanceOf(Explorer);
      expect(variableC.isEmpty()).toBe(true);
    });
  });

  describe("hasVariable", () => {
    it("returns true if a variable with the specified name exists", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasVariable("a")).toBe(true);
      expect(explorer.hasVariable("b")).toBe(true);
    });

    it("returns false if a variable with the specified name does not exist", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasVariable("c")).toBe(false);
    });
  });
});

describe("functions", () => {
  describe("findFunctions", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "function foo() { return 42; } function bar() { return 24; }";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions();
      functions.forEach((f) => expect(f).toBeInstanceOf(Explorer));
    });

    it("returns one entry per function", () => {
      const sourceCode =
        "function foo() { return 42; } function bar() { return 24; }";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions();
      expect(functions).toHaveLength(2);
    });

    it("returns an empty array if there are no functions", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions();
      expect(Array.isArray(functions)).toBe(true);
      expect(functions).toHaveLength(0);
    });

    it("finds only functions in the current scope", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    function bar() { function baz() { return 24; } }
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions();
      expect(functions).toHaveLength(2);
      expect(functions[0].matches("function foo() { return 42; }")).toBe(true);
      expect(
        functions[1].matches(
          "function bar() { function baz() { return 24; } }",
        ),
      ).toBe(true);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions();
      expect(functions).toHaveLength(0);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.findFunctions(true);
      expect(functions).toHaveLength(2);
    });
  });

  describe("findFunction", () => {
    it("returns an Explorer object for the specified function name", () => {
      const sourceCode = `
                    const a = [1, 2, 3];
                    function foo() { return 42; }
                    const b = 1;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo).toBeInstanceOf(Explorer);
      expect(functionFoo.matches("function foo() { return 42; }")).toBe(true);
    });

    it("returns an empty Explorer object if the specified function name is not found", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionBaz = explorer.findFunction("baz");
      expect(functionBaz).toBeInstanceOf(Explorer);
      expect(functionBaz.isEmpty()).toBe(true);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo.isEmpty()).toBe(true);

      const functionBar = explorer.findFunction("bar");
      expect(functionBar.isEmpty()).toBe(true);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo", true);
      expect(functionFoo).toBeInstanceOf(Explorer);
      expect(
        functionFoo.matches("const foo = function() { return 42; };"),
      ).toBe(true);

      const functionBar = explorer.findFunction("bar", true);
      expect(functionBar).toBeInstanceOf(Explorer);
      expect(functionBar.matches("const bar = () => 24;")).toBe(true);
    });
  });

  describe("hasFunction", () => {
    it("returns true if a function with the specified name exists", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                    const baz = function() { return 42; };
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo")).toBe(true);
    });

    it("returns false if a function with the specified name does not exist", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("baz")).toBe(false);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo")).toBe(false);
      expect(explorer.hasFunction("bar")).toBe(false);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo", true)).toBe(true);
      expect(explorer.hasFunction("bar", true)).toBe(true);
    });
  });
});

describe("types", () => {
  describe("findTypes", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const types = explorer.findTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toHaveLength(2);
      expect(types[0]).toBeInstanceOf(Explorer);
      expect(types[1]).toBeInstanceOf(Explorer);
    });

    it("returns an empty array if there are no types", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const types = explorer.findTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toHaveLength(0);
    });

    it("finds only types in the current scope", () => {
      const sourceCode = `
                    type Foo = { x: number; };
                    function bar() { type Baz = { y: string; }; }
                `;
      const explorer = new Explorer(sourceCode);
      const types = explorer.findTypes();
      expect(types).toHaveLength(1);
      expect(types[0].matches("type Foo = { x: number; };")).toBe(true);
    });
  });

  describe("findType", () => {
    it("returns an Explorer object for the specified type name", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo).toBeInstanceOf(Explorer);
      expect(typeFoo.matches("type Foo = { x: number; };")).toBe(true);

      const typeBar = explorer.findType("Bar");
      expect(typeBar).toBeInstanceOf(Explorer);
      expect(typeBar.matches("type Bar = { y: string; };")).toBe(true);
    });

    it("returns an empty Explorer object if the specified type name is not found", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const typeBaz = explorer.findType("Baz");
      expect(typeBaz).toBeInstanceOf(Explorer);
      expect(typeBaz.isEmpty()).toBe(true);
    });
  });

  describe("hasType", () => {
    it("returns true if a type with the specified name exists", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasType("Foo")).toBe(true);
      expect(explorer.hasType("Bar")).toBe(true);
    });

    it("returns false if a type with the specified name does not exist", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasType("Baz")).toBe(false);
    });
  });
});

describe("interfaces", () => {
  describe("findInterfaces", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.findInterfaces();
      expect(Array.isArray(interfaces)).toBe(true);
      expect(interfaces).toHaveLength(2);
      expect(interfaces[0]).toBeInstanceOf(Explorer);
      expect(interfaces[1]).toBeInstanceOf(Explorer);
    });

    it("returns an empty array if there are no interfaces", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.findInterfaces();
      expect(Array.isArray(interfaces)).toBe(true);
      expect(interfaces).toHaveLength(0);
    });

    it("finds only interfaces in the current scope", () => {
      const sourceCode = `
                    interface Foo { x: number; }
                    function bar() { interface Baz { y: string; } }
                `;
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.findInterfaces();
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].matches("interface Foo { x: number; }")).toBe(true);
    });
  });

  describe("findInterface", () => {
    it("returns an Explorer object for the specified interface name", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaceFoo = explorer.findInterface("Foo");
      expect(interfaceFoo).toBeInstanceOf(Explorer);
      expect(interfaceFoo.matches("interface Foo { x: number; }")).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar).toBeInstanceOf(Explorer);
      expect(interfaceBar.matches("interface Bar { y: string; }")).toBe(true);
    });

    it("returns an empty Explorer object if the specified interface name is not found", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaceBaz = explorer.findInterface("Baz");
      expect(interfaceBaz).toBeInstanceOf(Explorer);
      expect(interfaceBaz.isEmpty()).toBe(true);
    });
  });

  describe("hasInterface", () => {
    it("returns true if an interface with the specified name exists", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasInterface("Foo")).toBe(true);
      expect(explorer.hasInterface("Bar")).toBe(true);
    });

    it("returns false if an interface with the specified name does not exist", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasInterface("Baz")).toBe(false);
    });
  });
});
