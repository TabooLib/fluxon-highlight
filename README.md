# Fluxon Syntax Highlight

VS Code 语法高亮扩展，支持 `.fs` 文件和 YAML 中的 Fluxon 代码。

## 功能特性

- **语法高亮**：关键字、变量引用、运算符、注释、字符串
- **括号匹配**：`{}` `[]` `()` 自动配对
- **自动闭合**：括号、引号智能补全
- **注释切换**：`Ctrl+/` 行注释，`Shift+Alt+A` 块注释
- **代码折叠**：基于缩进和花括号，支持 `// region` 标记
- **YAML 嵌入**：在 YAML 文件中使用 `: ;` 标记 Fluxon 代码

## 语法支持

### 关键字

```fluxon
if else then when while for in
break continue return
try catch finally throw
def import print
```

### 变量引用

```fluxon
&variable
&num1
&?
```

### 运算符

```fluxon
..    // 范围
::    // 链式调用
->    // 箭头
?:    // Elvis
? :   // 三元
&& || !    // 逻辑
== != < > <= >=    // 比较
+ - * / %    // 算术
```

### 注解

```fluxon
@annotation(name="test", value=10)
def test t msg = { ... }
```

## YAML 嵌入

在 YAML 文件中，使用 `: ;` 标记 Fluxon 代码：

```yaml
script:
  onLoad: ;&level + 1
  onUpdate: ;if &player then print "Hello"
  complex: ;for i in 1..10 then { print &i }
```

## 安装

1. 复制扩展目录到 `.vscode/extensions/`
2. 重新加载 VS Code

## 开发

```bash
# 调试扩展
# 1. 在 VS Code 中打开此目录
# 2. 按 F5 启动调试
# 3. 在新窗口中打开 .fs 或 .yml 文件测试
```

## 注意事项

`.fs` 扩展名与 F# 冲突，需手动切换语言模式：
- 点击右下角语言标识
- 搜索并选择 "Fluxon"

## 示例

查看 `demo/` 目录中的示例文件：
- `test1.fs` - 基础语法
- `test2.fs` - 函数定义
- `test4.fs` - 列表操作
- `test5.fs` - 模块导入
- `test.yml` - YAML 嵌入
