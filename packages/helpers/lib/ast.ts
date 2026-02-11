import {
  Node,
  SourceFile,
  createSourceFile,
  ScriptTarget,
  ScriptKind,
  isTypeNode,
  TypeAliasDeclaration,
  isExpression,
  VariableStatement,
  FunctionDeclaration,
  SyntaxKind,
  Identifier,
  ArrowFunction,
  FunctionExpression,
  InterfaceDeclaration,
} from "typescript";

class Explorer {
  private tree: Node | null;
  private sourceFile: SourceFile | null;

  constructor(tree: string | Node | null = null) {
    if (tree === null) {
      this.tree = null;
      this.sourceFile = null;
    } else if (typeof tree === "string") {
      const sourceFile = createSourceFile(
        "inline.ts",
        tree,
        ScriptTarget.Latest,
        true,
        ScriptKind.TS,
      );
      this.sourceFile = sourceFile;
      this.tree =
        sourceFile.statements.length === 1
          ? sourceFile.statements[0]
          : sourceFile;
    } else if (Explorer.isNode(tree)) {
      this.tree = tree;
      this.sourceFile =
        typeof tree.getSourceFile === "function" ? tree.getSourceFile() : null;
    } else {
      throw new TypeError(
        "Explorer must be initialized with a string or TS AST node",
      );
    }
  }

  static isNode(value: unknown): value is Node {
    return (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      typeof value.kind === "number"
    );
  }

  isEmpty(): boolean {
    return this.tree === null;
  }

  toString(): string {
    if (this.tree === null) {
      return " no ast";
    }

    return this.tree.getText(this.sourceFile || undefined);
  }

  // Compares the current tree with another code snippet by parsing both and checking their structure
  equals(other: string): boolean {
    if (!this.tree || !other) {
      return this.isEmpty() && other === "";
    }

    const parseComparableCode = (
      text: string,
      referenceNode: Node,
    ): { node: Node; sourceFile: SourceFile } => {
      if (isTypeNode(referenceNode)) {
        const typeFile = createSourceFile(
          "inline.ts",
          `type __T = ${text}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const typeDecl = typeFile.statements[0] as TypeAliasDeclaration;
        return { node: typeDecl.type, sourceFile: typeFile };
      }

      if (isExpression(referenceNode)) {
        const exprFile = createSourceFile(
          "inline.ts",
          `const __v = ${text}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const varDecl = (exprFile.statements[0] as VariableStatement)
          .declarationList.declarations[0];
        return { node: varDecl.initializer!, sourceFile: exprFile };
      }

      if (referenceNode.kind === SyntaxKind.Parameter) {
        const paramFile = createSourceFile(
          "inline.ts",
          `function __f(__p: ${text}) {}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const funcDecl = paramFile.statements[0] as FunctionDeclaration;
        return { node: funcDecl.parameters[0], sourceFile: paramFile };
      }

      throw new Error("Unsupported node type for comparison");
    };

    const expected = parseComparableCode(other, this.tree);

    const compareNodes = (node1: Node, node2: Node): boolean => {
      if (node1.kind !== node2.kind) {
        return false;
      }

      if ("text" in node1 && "text" in node2) {
        if (node1.text !== undefined && node2.text !== undefined) {
          return node1.text === node2.text;
        }
      }

      const children1: Node[] = [];
      const children2: Node[] = [];
      node1.forEachChild((child) => children1.push(child));
      node2.forEachChild((child) => children2.push(child));

      if (children1.length !== children2.length) {
        return false;
      }

      for (let i = 0; i < children1.length; i++) {
        if (!compareNodes(children1[i], children2[i])) {
          return false;
        }
      }

      return true;
    };

    return compareNodes(this.tree, expected.node);
  }

  // Finds all nodes of a specific kind in the current tree
  private findAll(kind: SyntaxKind): Explorer[] {
    const nodes: Explorer[] = [];
    const root = this.tree || this.sourceFile;
    if (!root || !(root as SourceFile).statements) {
      return nodes;
    }

    (root as SourceFile).statements.forEach((statement) => {
      if (statement.kind === kind) {
        nodes.push(new Explorer(statement));
      }
    });
    return nodes;
  }

  // Finds variable statements that are not initialized with functions
  findVariables(): Explorer[] {
    const variables = this.findAll(SyntaxKind.VariableStatement);

    return variables.filter((v) => {
      const declaration = (v.tree as VariableStatement).declarationList
        .declarations[0];
      if (!declaration.initializer) {
        return true;
      }

      const initializerKind = declaration.initializer.kind;
      if (
        initializerKind === SyntaxKind.ArrowFunction ||
        initializerKind === SyntaxKind.FunctionExpression
      ) {
        return false;
      }

      return true;
    });
  }

  // Finds a variable by name, excluding function declarations
  findVariable(name: string): Explorer {
    const variables = this.findVariables();
    const cb = (v: Explorer) =>
      (
        (v.tree as VariableStatement).declarationList.declarations[0]
          .name as Identifier
      ).text === name;
    return variables.find(cb) ?? new Explorer();
  }

  // Checks if a variable with the given name exists in the current tree
  hasVariable(name: string): boolean {
    return !this.findVariable(name).isEmpty();
  }

  // Retrieves the type annotation of a variable statement if it exists, otherwise returns an empty Explorer
  getAnnotation(): Explorer {
    if (!this.tree) {
      return new Explorer();
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (declaration.type) {
        return new Explorer(declaration.type);
      }
    }

    return new Explorer();
  }

  hasAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    // A if ("type" in this.tree &&this.tree.type) {
    //     const typeAnnotation = new Explorer(this.tree.type);
    //     return typeAnnotation.equals(annotation);
    // }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (declaration.type) {
        const typeAnnotation = new Explorer(declaration.type);
        return typeAnnotation.equals(annotation);
      }
    }

    return false;
  }

  // Finds all functions in the current tree, including function declarations and function expressions assigned to variables
  findFunctions(): Explorer[] {
    const functionDeclarations = this.findAll(SyntaxKind.FunctionDeclaration);
    const variableStatements = this.findAll(SyntaxKind.VariableStatement);
    const functionVariables = variableStatements.filter((v) => {
      const declaration = (v.tree as VariableStatement).declarationList
        .declarations[0];
      if (!declaration.initializer) {
        return false;
      }

      const initializerKind = declaration.initializer.kind;
      return (
        initializerKind === SyntaxKind.ArrowFunction ||
        initializerKind === SyntaxKind.FunctionExpression
      );
    });
    return [...functionDeclarations, ...functionVariables];
  }

  // Finds a function by name, checking both function declarations and variable statements that are initialized with functions
  findFunction(name: string): Explorer {
    const functions = this.findFunctions();
    const cb = (f: Explorer) => {
      if (f.tree?.kind === SyntaxKind.FunctionDeclaration) {
        return (f.tree as FunctionDeclaration).name?.text === name;
      }

      if (f.tree?.kind === SyntaxKind.VariableStatement) {
        const declaration = (f.tree as VariableStatement).declarationList
          .declarations[0];
        return (declaration.name as Identifier).text === name;
      }
    };

    return functions.find(cb) ?? new Explorer();
  }

  // Checks if a function with the given name exists in the current tree
  hasFunction(name: string): boolean {
    return !this.findFunction(name).isEmpty();
  }

  // Checks if a function (either a function declaration or a variable statement initialized with a function) has a specific return type annotation
  hasReturnAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    if (this.tree.kind === SyntaxKind.FunctionDeclaration) {
      const funcDecl = this.tree as FunctionDeclaration;
      if (funcDecl.type) {
        const returnAnnotation = new Explorer(funcDecl.type);
        return returnAnnotation.equals(annotation);
      }
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.initializer &&
        (declaration.initializer.kind === SyntaxKind.ArrowFunction ||
          declaration.initializer.kind === SyntaxKind.FunctionExpression)
      ) {
        const funcExpr = declaration.initializer as
          | ArrowFunction
          | FunctionExpression;
        if (funcExpr.type) {
          const returnAnnotation = new Explorer(funcExpr.type);
          return returnAnnotation.equals(annotation);
        }
      }
    }

    return false;
  }

  // Retrieves the parameters of a function, whether it's a function declaration or a variable statement initialized with a function
  getParameters(): Explorer[] {
    if (!this.tree) {
      return [];
    }

    if (this.tree.kind === SyntaxKind.FunctionDeclaration) {
      const funcDecl = this.tree as FunctionDeclaration;
      return funcDecl.parameters.map((param) => new Explorer(param));
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.initializer &&
        (declaration.initializer.kind === SyntaxKind.ArrowFunction ||
          declaration.initializer.kind === SyntaxKind.FunctionExpression)
      ) {
        const funcExpr = declaration.initializer as
          | ArrowFunction
          | FunctionExpression;
        return funcExpr.parameters.map((param) => new Explorer(param));
      }
    }

    return [];
  }

  // Finds all type alias declarations in the current tree
  findTypes(): Explorer[] {
    return this.findAll(SyntaxKind.TypeAliasDeclaration);
  }

  // Finds a type alias declaration by name
  findType(name: string): Explorer {
    const types = this.findTypes();
    const cb = (t: Explorer) =>
      (t.tree as TypeAliasDeclaration).name.text === name;
    return types.find(cb) ?? new Explorer();
  }

  // Checks if a type alias declaration with the given name exists in the current tree
  hasType(name: string): boolean {
    return !this.findType(name).isEmpty();
  }

  // Finds all interface declarations in the current tree
  findInterfaces(): Explorer[] {
    return this.findAll(SyntaxKind.InterfaceDeclaration);
  }

  // Finds an interface declaration by name
  findInterface(name: string): Explorer {
    const interfaces = this.findInterfaces();
    const cb = (i: Explorer) =>
      (i.tree as InterfaceDeclaration).name.text === name;
    return interfaces.find(cb) ?? new Explorer();
  }

  // Checks if an interface declaration with the given name exists in the current tree
  hasInterface(name: string): boolean {
    return !this.findInterface(name).isEmpty();
  }
}

export { Explorer };
