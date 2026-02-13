import { Explorer } from "../helpers/lib/class/explorer";

describe("Explorer", () => {
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
      expect(explorer1.equals("const a = 1;")).toBe(true);

      const explorer2 = new Explorer("function foo() { return 42; }");
      expect(explorer2.equals("function foo() { return 42; }")).toBe(true);

      const explorer3 = new Explorer("interface Bar { x: number; }");
      expect(explorer3.equals("interface Bar { x: number; }")).toBe(true);
    });

    it("returns false when comparing non-equivalent nodes", () => {
      const explorer1 = new Explorer("const a = 1;");
      expect(explorer1.equals("const b = 2;")).toBe(false);

      const explorer2 = new Explorer("function foo() { return 42; }");
      expect(explorer2.equals("function bar() { return 42; }")).toBe(false);

      const explorer3 = new Explorer("interface Bar { x: number; }");
      expect(explorer3.equals("interface Baz { x: number; }")).toBe(false);
    });

    it("does not consider whitespace differences as non-equivalent", () => {
      const explorer1 = new Explorer("const a = 1;");
      expect(explorer1.equals("const a =  1;")).toBe(true);
      expect(explorer1.equals("const  a = 1; ")).toBe(true);
      expect(explorer1.equals(" const a = 1;")).toBe(true);
      expect(explorer1.equals(" const a=1; ")).toBe(true);

      const explorer2 = new Explorer("function foo() { return 42; }");
      expect(explorer2.equals("function foo( ) { return 42; }")).toBe(true);
      expect(explorer2.equals("function foo () { return 42; } ")).toBe(true);
      expect(explorer2.equals(" function foo() { return 42; }")).toBe(true);
      expect(explorer2.equals(" function foo() { return 42; } ")).toBe(true);

      const explorer3 = new Explorer("interface Bar { x: number; }");
      expect(explorer3.equals("interface Bar { x:number; }")).toBe(true);
      expect(explorer3.equals("interface Bar { x:  number; } ")).toBe(true);
      expect(explorer3.equals(" interface Bar  { x: number; }")).toBe(true);
      expect(explorer3.equals(" interface Bar { x: number; } ")).toBe(true);
    });

    it("does not consider trailing semicolons as non-equivalent", () => {
      const explorer1 = new Explorer("const a = 1;");
      expect(explorer1.equals("const a = 1")).toBe(true);

      const explorer2 = new Explorer("function foo() { return 42; }");
      expect(explorer2.equals("function foo() { return 42 }")).toBe(true);

      const explorer3 = new Explorer("interface Bar { x: number; }");
      expect(explorer3.equals("interface Bar { x: number }")).toBe(true);
    });
  });

  describe("variables", () => {
    describe("findVariables", () => {
      it("returns an array of Explorer objects", () => {
        const sourceCode = "const a = 1; const b = 2;";
        const explorer = new Explorer(sourceCode);
        const variables = explorer.findVariables();
        expect(Array.isArray(variables)).toBe(true);
        expect(variables.length).toBe(2);
        expect(variables[0]).toBeInstanceOf(Explorer);
        expect(variables[1]).toBeInstanceOf(Explorer);
      });

      it("returns an empty array if there are no variables", () => {
        const sourceCode = "function foo() { return 42; }";
        const explorer = new Explorer(sourceCode);
        const variables = explorer.findVariables();
        expect(Array.isArray(variables)).toBe(true);
        expect(variables.length).toBe(0);
      });

      it("finds only variables in the current scope", () => {
        const sourceCode = `
                    const a = 1;
                    function foo() { const b = 2; };
                `;
        const explorer = new Explorer(sourceCode);
        const variables = explorer.findVariables();
        expect(variables.length).toBe(1);
        expect(variables[0].equals("const a = 1;")).toBe(true);
      });

      it("does not find function expressions or arrow functions", () => {
        const sourceCode = `
                    const a = 1;
                    const foo = function() { return 42; };
                    const bar = () => 42;
                `;
        const explorer = new Explorer(sourceCode);
        const variables = explorer.findVariables();
        expect(variables.length).toBe(1);
        expect(variables[0].equals("const a = 1;")).toBe(true);
      });
    });

    describe("findVariable", () => {
      it("returns an Explorer object for the specified variable name", () => {
        const sourceCode = "const a = 1; const b = 2;";
        const explorer = new Explorer(sourceCode);
        const variableA = explorer.findVariable("a");
        expect(variableA).toBeInstanceOf(Explorer);
        expect(variableA.equals("const a = 1;")).toBe(true);

        const variableB = explorer.findVariable("b");
        expect(variableB).toBeInstanceOf(Explorer);
        expect(variableB.equals("const b = 2;")).toBe(true);
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
        expect(Array.isArray(functions)).toBe(true);
        expect(functions.length).toBe(2);
        expect(functions[0]).toBeInstanceOf(Explorer);
        expect(functions[1]).toBeInstanceOf(Explorer);
      });

      it("returns an empty array if there are no functions", () => {
        const sourceCode = "const a = 1; const b = 2;";
        const explorer = new Explorer(sourceCode);
        const functions = explorer.findFunctions();
        expect(Array.isArray(functions)).toBe(true);
        expect(functions.length).toBe(0);
      });

      it("finds only functions in the current scope", () => {
        const sourceCode = `
                    function foo() { return 42; }
                    function bar() { function baz() { return 24; } }
                `;
        const explorer = new Explorer(sourceCode);
        const functions = explorer.findFunctions();
        expect(functions.length).toBe(2);
        expect(functions[0].equals("function foo() { return 42; }")).toBe(true);
        expect(
          functions[1].equals(
            "function bar() { function baz() { return 24; } }",
          ),
        ).toBe(true);
      });

      it("finds function expressions and arrow functions assigned to variables", () => {
        const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
        const explorer = new Explorer(sourceCode);
        const functions = explorer.findFunctions();
        expect(functions.length).toBe(2);
        expect(
          functions[0].equals("const foo = function() { return 42; };"),
        ).toBe(true);
        expect(functions[1].equals("const bar = () => 24;")).toBe(true);
      });
    });

    describe("findFunction", () => {
      it("returns an Explorer object for the specified function name (arrow function and function expression included)", () => {
        const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                    const baz = function() { return 42; };
                `;
        const explorer = new Explorer(sourceCode);
        const functionFoo = explorer.findFunction("foo");
        expect(functionFoo).toBeInstanceOf(Explorer);
        expect(functionFoo.equals("function foo() { return 42; }")).toBe(true);

        const functionBar = explorer.findFunction("bar");
        expect(functionBar).toBeInstanceOf(Explorer);
        expect(functionBar.equals("const bar = () => 24;")).toBe(true);

        const functionBaz = explorer.findFunction("baz");
        expect(functionBaz).toBeInstanceOf(Explorer);
        expect(
          functionBaz.equals("const baz = function() { return 42; };"),
        ).toBe(true);
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
    });

    describe("hasFunction", () => {
      it("returns true if a function with the specified name exists (arrow function and function expression included)", () => {
        const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                    const baz = function() { return 42; };
                `;
        const explorer = new Explorer(sourceCode);
        expect(explorer.hasFunction("foo")).toBe(true);
        expect(explorer.hasFunction("bar")).toBe(true);
        expect(explorer.hasFunction("baz")).toBe(true);
      });

      it("returns false if a function with the specified name does not exist", () => {
        const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
        const explorer = new Explorer(sourceCode);
        expect(explorer.hasFunction("baz")).toBe(false);
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
        expect(types.length).toBe(2);
        expect(types[0]).toBeInstanceOf(Explorer);
        expect(types[1]).toBeInstanceOf(Explorer);
      });

      it("returns an empty array if there are no types", () => {
        const sourceCode = "const a = 1; const b = 2;";
        const explorer = new Explorer(sourceCode);
        const types = explorer.findTypes();
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBe(0);
      });

      it("finds only types in the current scope", () => {
        const sourceCode = `
                    type Foo = { x: number; };
                    function bar() { type Baz = { y: string; }; }
                `;
        const explorer = new Explorer(sourceCode);
        const types = explorer.findTypes();
        expect(types.length).toBe(1);
        expect(types[0].equals("type Foo = { x: number; };")).toBe(true);
      });
    });

    describe("findType", () => {
      it("returns an Explorer object for the specified type name", () => {
        const sourceCode =
          "type Foo = { x: number; }; type Bar = { y: string; };";
        const explorer = new Explorer(sourceCode);
        const typeFoo = explorer.findType("Foo");
        expect(typeFoo).toBeInstanceOf(Explorer);
        expect(typeFoo.equals("type Foo = { x: number; };")).toBe(true);

        const typeBar = explorer.findType("Bar");
        expect(typeBar).toBeInstanceOf(Explorer);
        expect(typeBar.equals("type Bar = { y: string; };")).toBe(true);
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
        expect(interfaces.length).toBe(2);
        expect(interfaces[0]).toBeInstanceOf(Explorer);
        expect(interfaces[1]).toBeInstanceOf(Explorer);
      });

      it("returns an empty array if there are no interfaces", () => {
        const sourceCode = "const a = 1; const b = 2;";
        const explorer = new Explorer(sourceCode);
        const interfaces = explorer.findInterfaces();
        expect(Array.isArray(interfaces)).toBe(true);
        expect(interfaces.length).toBe(0);
      });

      it("finds only interfaces in the current scope", () => {
        const sourceCode = `
                    interface Foo { x: number; }
                    function bar() { interface Baz { y: string; } }
                `;
        const explorer = new Explorer(sourceCode);
        const interfaces = explorer.findInterfaces();
        expect(interfaces.length).toBe(1);
        expect(interfaces[0].equals("interface Foo { x: number; }")).toBe(true);
      });
    });

    describe("findInterface", () => {
      it("returns an Explorer object for the specified interface name", () => {
        const sourceCode =
          "interface Foo { x: number; } interface Bar { y: string; }";
        const explorer = new Explorer(sourceCode);
        const interfaceFoo = explorer.findInterface("Foo");
        expect(interfaceFoo).toBeInstanceOf(Explorer);
        expect(interfaceFoo.equals("interface Foo { x: number; }")).toBe(true);

        const interfaceBar = explorer.findInterface("Bar");
        expect(interfaceBar).toBeInstanceOf(Explorer);
        expect(interfaceBar.equals("interface Bar { y: string; }")).toBe(true);
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
});
