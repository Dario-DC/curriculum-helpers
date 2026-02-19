import {
  Node,
  SourceFile,
  createSourceFile,
  ScriptTarget,
  ScriptKind,
  TypeAliasDeclaration,
  VariableStatement,
  FunctionDeclaration,
  SyntaxKind,
  Identifier,
  ArrowFunction,
  FunctionExpression,
  InterfaceDeclaration,
  ParameterDeclaration,
  ClassDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
} from "typescript";

function createSource(source: string): SourceFile {
  return createSourceFile(
    "inline.ts",
    source,
    ScriptTarget.Latest,
    true,
    ScriptKind.TS,
  );
}

function createTree(
  code: Node | string,
  node:
    | SyntaxKind.TypeReference
    | SyntaxKind.MethodDeclaration
    | SyntaxKind.Unknown = SyntaxKind.Unknown,
): Node | null {
  if (typeof code === "string") {
    if (!code.trim()) {
      return null;
    }

    let sourceFile: SourceFile;

    if (node === SyntaxKind.MethodDeclaration) {
      sourceFile = createSource(`class _ { ${code} }`);
      const classDecl = sourceFile.statements[0] as ClassDeclaration;
      const methodDecl = classDecl.members.find(
        (member) => member.kind === SyntaxKind.MethodDeclaration,
      ) as MethodDeclaration | undefined;
      return methodDecl || null;
    }

    if (node === SyntaxKind.TypeReference) {
      sourceFile = createSource(`let _: ${code};`);
      const varStatement = sourceFile.statements[0] as VariableStatement;
      const declaration = varStatement.declarationList.declarations[0];
      return declaration.type || null;
    }

    sourceFile = createSource(code);
    return sourceFile.statements.length === 1
      ? sourceFile.statements[0]
      : sourceFile;
  }

  if (code.getText().trim() === "") {
    return null;
  }

  return code;
}

function permutate(array: string[]): string[][] {
  if (array.length === 0) return [[]];

  const result: string[][] = [];
  for (let i = 0; i < array.length; i++) {
    const current = array[i];
    const remaining = array.slice(0, i).concat(array.slice(i + 1));
    const remainingPermuted = permutate(remaining);
    for (const perm of remainingPermuted) {
      result.push([current, ...perm]);
    }
  }

  return result;
}

function combine(array: string[][], symbol: string): string[] {
  if (array.length === 0) return [];
  const result: string[] = [];
  for (const group of array) {
    result.push(group.join(symbol));
  }

  return result;
}

class Explorer {
  private tree: Node | null;

  constructor(
    tree: Node | string = "",
    node:
      | SyntaxKind.TypeReference
      | SyntaxKind.MethodDeclaration
      | SyntaxKind.Unknown = SyntaxKind.Unknown,
  ) {
    this.tree = createTree(tree, node);
  }

  isEmpty(): boolean {
    return this.tree === null;
  }

  toString(): string {
    return this.tree ? this.tree.getText() : "no ast";
  }

  // Compares the current tree with another tree, ignoring semicolons and whitespace
  matches(other: string | Explorer): boolean {
    let otherExplorer: Explorer;

    if (typeof other === "string") {
      // If current node is a MethodDeclaration, wrap the string in a class for proper parsing
      if (this.tree?.kind === SyntaxKind.MethodDeclaration) {
        otherExplorer = new Explorer(other, SyntaxKind.MethodDeclaration);
      } else {
        otherExplorer = new Explorer(other);
      }
    } else {
      otherExplorer = other;
    }

    if (this.isEmpty() || otherExplorer.isEmpty()) {
      return false;
    }

    const SEMICOLON = SyntaxKind.SemicolonToken;

    const filterChildren = (node: Node): Node[] => {
      const children: Node[] = [];
      for (let i = 0; i < node.getChildCount(); i++) {
        const child = node.getChildAt(i);
        if (child.kind !== SEMICOLON) {
          children.push(child);
        }
      }

      return children;
    };

    const compareNodes = (node1: Node, node2: Node): boolean => {
      if (node1.kind !== node2.kind) {
        return false;
      }

      const children1 = filterChildren(node1);
      const children2 = filterChildren(node2);

      if (children1.length === 0 && children2.length === 0) {
        // Leaf node - compare text content
        return node1.getText() === node2.getText();
      }

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

    return compareNodes(this.tree as Node, otherExplorer.tree as Node);
  }

  // Finds all nodes of a specific kind in the tree
  findAll(kind: SyntaxKind): Explorer[] {
    if (this.isEmpty()) {
      return [];
    }

    const nodes: Explorer[] = [];
    const root = this.tree as Node;

    // Check if the root is a SourceFile or a single node
    if (root.kind === SyntaxKind.SourceFile) {
      // Iterate through the statements of the SourceFile
      (root as SourceFile).statements.forEach((statement) => {
        if (statement.kind === kind) {
          nodes.push(new Explorer(statement));
        }
      });
    }

    // If the root is a single node, check if it matches the kind
    if (root.kind === kind) {
      nodes.push(new Explorer(root));
    }

    return nodes;
  }

  // Finds all variable statements
  findVariables(): Explorer[] {
    return this.findAll(SyntaxKind.VariableStatement);
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

  // Retrieves the type annotation of the current node if it exists, otherwise returns an empty Explorer
  getAnnotation(): Explorer {
    if (this.isEmpty()) {
      return new Explorer();
    }

    const node = this.tree as Node;

    // Handle VariableStatement (variable declarations)
    if (node.kind === SyntaxKind.VariableStatement) {
      const declaration = (node as VariableStatement).declarationList
        .declarations[0];
      if (declaration.type) {
        return new Explorer(declaration.type);
      }
    }

    // Handle Parameter (function/method parameters)
    if (node.kind === SyntaxKind.Parameter) {
      const param = node as ParameterDeclaration;
      if (param.type) {
        return new Explorer(param.type);
      }
    }

    // Handle PropertyDeclaration (class properties)
    if (node.kind === SyntaxKind.PropertyDeclaration) {
      const prop = node as PropertyDeclaration;
      if (prop.type) {
        return new Explorer(prop.type);
      }
    }

    // Handle TypeAliasDeclaration (the type itself)
    if (node.kind === SyntaxKind.TypeAliasDeclaration) {
      const typeAlias = node as TypeAliasDeclaration;
      return new Explorer(typeAlias.type);
    }

    return new Explorer();
  }

  // Checks if the current node's type annotation is a union of the specified types
  isUnionOf(types: string[]): boolean {
    if (this.isEmpty()) {
      return false;
    }

    if (this.tree?.kind !== SyntaxKind.UnionType) {
      return false;
    }

    const expectedTypes = combine(permutate(types), " | ");

    return expectedTypes.some((expected) => {
      const expectedExplorer = new Explorer(expected, SyntaxKind.TypeReference);
      return this.matches(expectedExplorer);
    });
  }

  // Checks if the current node's type annotation is an intersection of the specified types
  isIntersectionOf(types: string[]): boolean {
    if (this.isEmpty()) {
      return false;
    }

    if (this.tree?.kind !== SyntaxKind.IntersectionType) {
      return false;
    }

    const expectedTypes = combine(permutate(types), " & ");
    return expectedTypes.some((expected) => {
      const expectedExplorer = new Explorer(expected, SyntaxKind.TypeReference);
      return this.matches(expectedExplorer);
    });
  }

  // Checks if the current node has a type annotation that matches the provided annotation string
  hasAnnotation(annotation: string): boolean {
    const currentAnnotation = this.getAnnotation();
    if (currentAnnotation.isEmpty()) {
      return false;
    }

    const annotationNode = createTree(annotation, SyntaxKind.TypeReference);
    if (annotationNode === null) {
      return false;
    }

    const annotationExplorer = new Explorer(annotationNode);
    return currentAnnotation.matches(annotationExplorer);
  }

  // Finds all functions in the current tree. If withVariables is true, it includes function expressions and arrow functions assigned to variables
  findFunctions(withVariables: boolean = false): Explorer[] {
    const functionDeclarations = this.findAll(SyntaxKind.FunctionDeclaration);
    if (!withVariables) {
      return functionDeclarations;
    }

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

  // Finds a function by name, checking function declarations, variable statements with functions, and method declarations
  // If withVariables is true, it includes function expressions and arrow functions assigned to variables
  findFunction(name: string, withVariables: boolean = false): Explorer {
    const functions = this.findFunctions(withVariables);
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
  hasFunction(name: string, withVariables: boolean = false): boolean {
    return !this.findFunction(name, withVariables).isEmpty();
  }

  // Checks if a function (function declaration, method, arrow function, or function expression) has a specific return type annotation
  hasReturnAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    let functionNode:
      | FunctionDeclaration
      | MethodDeclaration
      | ArrowFunction
      | FunctionExpression
      | null = null;

    // Handle FunctionDeclaration
    if (this.tree.kind === SyntaxKind.FunctionDeclaration) {
      functionNode = this.tree as FunctionDeclaration;
    }

    // Handle MethodDeclaration
    if (this.tree.kind === SyntaxKind.MethodDeclaration) {
      functionNode = this.tree as MethodDeclaration;
    }

    // Handle ArrowFunction and FunctionExpression directly
    if (
      this.tree.kind === SyntaxKind.ArrowFunction ||
      this.tree.kind === SyntaxKind.FunctionExpression
    ) {
      functionNode = this.tree as ArrowFunction | FunctionExpression;
    }

    // Handle VariableStatement with function initializer
    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.initializer &&
        (declaration.initializer.kind === SyntaxKind.ArrowFunction ||
          declaration.initializer.kind === SyntaxKind.FunctionExpression)
      ) {
        functionNode = declaration.initializer as
          | ArrowFunction
          | FunctionExpression;
      }
    }

    // Check return type if we found a function node
    if (functionNode && functionNode.type) {
      const returnAnnotation = new Explorer(functionNode.type);
      return returnAnnotation.matches(annotation);
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

  // Finds all class declarations in the current tree
  findClasses(): Explorer[] {
    return this.findAll(SyntaxKind.ClassDeclaration);
  }

  // Finds a class declaration by name
  findClass(name: string): Explorer {
    const classes = this.findClasses();
    const cb = (c: Explorer) =>
      (c.tree as ClassDeclaration).name?.text === name;
    return classes.find(cb) ?? new Explorer();
  }

  // Checks if a class declaration with the given name exists in the current tree
  hasClass(name: string): boolean {
    return !this.findClass(name).isEmpty();
  }

  // Finds all method declarations within a class
  findMethods(): Explorer[] {
    if (this.tree?.kind === SyntaxKind.ClassDeclaration) {
      const classDecl = this.tree as ClassDeclaration;
      return classDecl.members
        .filter((member) => member.kind === SyntaxKind.MethodDeclaration)
        .map((method) => new Explorer(method));
    }

    return [];
  }

  // Finds a method declaration by name within a class
  findMethod(name: string): Explorer {
    const methods = this.findMethods();
    const cb = (m: Explorer) =>
      ((m.tree as MethodDeclaration).name as Identifier).text === name;
    return methods.find(cb) ?? new Explorer();
  }

  // Checks if a method declaration with the given name exists in the current tree
  hasMethod(name: string): boolean {
    return !this.findMethod(name).isEmpty();
  }
}

export { Explorer };
