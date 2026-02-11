import { Explorer } from "../helpers/lib/ast";

describe("Explorer", () => {
  describe("hasProperty", () => {
    describe("InterfaceDeclaration", () => {
      it("should find a property by name only", () => {
        const code = `
          interface User {
            name: string;
            age: number;
          }
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("name")).toBe(true);
        expect(explorer.hasProperty("age")).toBe(true);
        expect(explorer.hasProperty("email")).toBe(false);
      });

      it("should check property with specific type", () => {
        const code = `
          interface User {
            name: string;
            age: number;
          }
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("name", "string")).toBe(true);
        expect(explorer.hasProperty("age", "number")).toBe(true);
        expect(explorer.hasProperty("name", "number")).toBe(false);
        expect(explorer.hasProperty("age", "string")).toBe(false);
      });

      it("should check optional properties", () => {
        const code = `
          interface User {
            name: string;
            age?: number;
            email: string;
          }
        `;
        const explorer = new Explorer(code);

        // Check optionality without type
        expect(explorer.hasProperty("name", undefined, false)).toBe(true);
        expect(explorer.hasProperty("age", undefined, true)).toBe(true);
        expect(explorer.hasProperty("email", undefined, false)).toBe(true);

        // Check wrong optionality
        expect(explorer.hasProperty("name", undefined, true)).toBe(false);
        expect(explorer.hasProperty("age", undefined, false)).toBe(false);
      });

      it("should check property with type and optionality", () => {
        const code = `
          interface User {
            name: string;
            age?: number;
          }
        `;
        const explorer = new Explorer(code);

        expect(explorer.hasProperty("name", "string", false)).toBe(true);
        expect(explorer.hasProperty("age", "number", true)).toBe(true);

        // Wrong combinations
        expect(explorer.hasProperty("name", "string", true)).toBe(false);
        expect(explorer.hasProperty("age", "number", false)).toBe(false);
        expect(explorer.hasProperty("age", "string", true)).toBe(false);
      });

      it("should handle union types", () => {
        const code = `
          interface User {
            status: "active" | "inactive";
          }
        `;
        const explorer = new Explorer(code);

        expect(explorer.hasProperty("status")).toBe(true);
        expect(explorer.hasProperty("status", '"active" | "inactive"')).toBe(
          true,
        );
      });
    });

    describe("TypeAliasDeclaration with TypeLiteral", () => {
      it("should find a property by name only", () => {
        const code = `
          type Point = {
            x: number;
            y: number;
          };
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("x")).toBe(true);
        expect(explorer.hasProperty("y")).toBe(true);
        expect(explorer.hasProperty("z")).toBe(false);
      });

      it("should check property with specific type", () => {
        const code = `
          type Point = {
            x: number;
            label: string;
          };
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("x", "number")).toBe(true);
        expect(explorer.hasProperty("label", "string")).toBe(true);
        expect(explorer.hasProperty("x", "string")).toBe(false);
      });

      it("should check optional properties", () => {
        const code = `
          type Config = {
            host: string;
            port?: number;
          };
        `;
        const explorer = new Explorer(code);

        expect(explorer.hasProperty("host", undefined, false)).toBe(true);
        expect(explorer.hasProperty("port", undefined, true)).toBe(true);
        expect(explorer.hasProperty("port", undefined, false)).toBe(false);
      });

      it("should handle non-TypeLiteral type aliases", () => {
        const code = `
          type StringAlias = string;
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("anything")).toBe(false);
      });
    });

    describe("FunctionDeclaration parameters", () => {
      it("should find property in function parameter type", () => {
        const code = `
          function test(options: { enabled: boolean; timeout: number }) {}
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("enabled")).toBe(true);
        expect(explorer.hasProperty("timeout")).toBe(true);
        expect(explorer.hasProperty("retry")).toBe(false);
      });

      it("should check property type in function parameter", () => {
        const code = `
          function test(options: { enabled: boolean; timeout: number }) {}
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("enabled", "boolean")).toBe(true);
        expect(explorer.hasProperty("timeout", "number")).toBe(true);
        expect(explorer.hasProperty("enabled", "number")).toBe(false);
      });

      it("should check optional properties in function parameters", () => {
        const code = `
          function test(options: { required: string; optional?: number }) {}
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("required", undefined, false)).toBe(true);
        expect(explorer.hasProperty("optional", undefined, true)).toBe(true);
        expect(explorer.hasProperty("required", undefined, true)).toBe(false);
      });

      it("should check multiple parameters", () => {
        const code = `
          function test(
            first: { id: string },
            second: { name: string }
          ) {}
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("id")).toBe(true);
        expect(explorer.hasProperty("name")).toBe(true);
      });
    });

    describe("Arrow functions and function expressions", () => {
      it("should find property in arrow function parameter", () => {
        const code = `
          const handler = (event: { type: string; data: unknown }) => {};
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("type")).toBe(true);
        expect(explorer.hasProperty("data")).toBe(true);
      });

      it("should check property type in arrow function parameter", () => {
        const code = `
          const handler = (event: { type: string }) => {};
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("type", "string")).toBe(true);
        expect(explorer.hasProperty("type", "number")).toBe(false);
      });

      it("should find property in function expression parameter", () => {
        const code = `
          const handler = function(event: { id: number }) {};
        `;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("id")).toBe(true);
        expect(explorer.hasProperty("id", "number")).toBe(true);
      });
    });

    describe("Parameter node directly", () => {
      it("should check properties when tree is a Parameter node", () => {
        const code = `
          function test(options: { retry: boolean; timeout?: number }) {}
        `;
        const sourceFile = new Explorer(code);
        const params = sourceFile.getParameters();

        expect(params[0].hasProperty("retry")).toBe(true);
        expect(params[0].hasProperty("timeout")).toBe(true);
        expect(params[0].hasProperty("retry", "boolean")).toBe(true);
        expect(params[0].hasProperty("timeout", "number", true)).toBe(true);
      });
    });

    describe("Edge cases", () => {
      it("should return false for empty tree", () => {
        const explorer = new Explorer(null);
        expect(explorer.hasProperty("anything")).toBe(false);
      });

      it("should return false for unsupported node types", () => {
        const code = `const x = 5;`;
        const explorer = new Explorer(code);
        expect(explorer.hasProperty("anything")).toBe(false);
      });

      it("should handle properties without type annotations", () => {
        const code = `
          interface Test {
            name;
          }
        `;
        // This might cause a parsing error or just not have a type
        // The method should handle it gracefully
        const explorer = new Explorer(code);
        // If type is specified but property has no type, should return false
        expect(explorer.hasProperty("name", "string")).toBe(false);
      });
    });

    describe("Complex types", () => {
      it("should check properties with complex types", () => {
        const code = `
          interface Config {
            handlers: Array<string>;
            data: Record<string, unknown>;
          }
        `;
        const explorer = new Explorer(code);

        expect(explorer.hasProperty("handlers")).toBe(true);
        expect(explorer.hasProperty("data")).toBe(true);
        expect(explorer.hasProperty("handlers", "Array<string>")).toBe(true);
        expect(explorer.hasProperty("data", "Record<string, unknown>")).toBe(
          true,
        );
      });

      it("should check properties with nested object types", () => {
        const code = `
          interface User {
            address: {
              street: string;
              city: string;
            };
          }
        `;
        const explorer = new Explorer(code);

        expect(explorer.hasProperty("address")).toBe(true);
        expect(
          explorer.hasProperty("address", "{ street: string; city: string; }"),
        ).toBe(true);
      });
    });
  });
});
