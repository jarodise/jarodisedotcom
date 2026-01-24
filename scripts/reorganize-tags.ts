import * as fs from "fs";
import * as path from "path";

const BLOG_DIR = path.join(process.cwd(), "src/blog");

const CATEGORIES = [
    "数字游民",
    "生活方式",
    "旅行旅居",
    "创业赚钱",
    "思考哲学",
    "自我成长",
    "英语学习",
    "年终总结",
    "科技/人工智能",
];

const MAPPING: Record<string, string> = {
    // 数字游民
    "数字游民": "数字游民",
    "Digital Nomad": "数字游民",
    "扫盲": "数字游民",
    "定义": "数字游民",
    "概念解析": "数字游民",

    // 生活方式
    "生活方式": "生活方式",
    "生活方式设计": "生活方式",
    "极简主义": "生活方式",
    "新富人": "生活方式",
    "液态生活": "生活方式",

    // 旅行旅居
    "旅行": "旅行旅居",
    "旅居": "旅行旅居",
    "攻略": "旅行旅居",
    "指南": "旅行旅居",
    "城市指南": "旅行旅居",
    "地理套利": "旅行旅居",
    "哥伦比亚": "旅行旅居",
    "土耳其": "旅行旅居",
    "墨西哥": "旅行旅居",
    "泰国": "旅行旅居",
    "曼谷": "旅行旅居",
    "清迈": "旅行旅居",
    "Bali": "旅行旅居",
    "Canggu": "旅行旅居",
    "危地马拉": "旅行旅居",
    "安塔利亚": "旅行旅居",
    "卡什": "旅行旅居",
    "Playa Del Carmen": "旅行旅居",
    "海外生活": "旅行旅居",
    "WHV": "旅行旅居",
    "打工度假": "旅行旅居",
    "新西兰": "旅行旅居",
    "拉美": "旅行旅居",
    "东南亚": "旅行旅居",
    "安全": "旅行旅居",
    "独旅": "旅行旅居",

    // 创业赚钱
    "创业": "创业赚钱",
    "赚钱": "创业赚钱",
    "内容创业": "创业赚钱",
    "创作者经济": "创业赚钱",
    "内容创作": "创业赚钱",
    "副业": "创业赚钱",
    "理财": "创业赚钱",
    "财务自由": "创业赚钱",
    "FIRE": "创业赚钱",
    "F-You Money": "创业赚钱",
    "现金流象限": "创业赚钱",
    "Dropshipping": "创业赚钱",
    "SEO": "创业赚钱",
    "内容付费": "创业赚钱",
    "内容运营": "创业赚钱",
    "私域流量": "创业赚钱",
    "Naval Ravikant": "创业赚钱",
    "Pieter Levels": "创业赚钱",
    "富爸爸穷爸爸": "创业赚钱",

    // 思考哲学
    "思考": "思考哲学",
    "哲学": "思考哲学",
    "反思": "思考哲学",
    "现代性": "思考哲学",
    "价值观": "思考哲学",
    "态度": "思考哲学",
    "人生选择": "思考哲学",
    "社会观察": "思考哲学",
    "互联网": "思考哲学",
    "全球化": "思考哲学",

    // 自我成长
    "自我成长": "自我成长",
    "自我提升": "自我成长",
    "个人成长": "自我成长",
    "效率": "自我成长",
    "效率工具": "自我成长",
    "PKM": "自我成长",
    "Logseq": "自我成长",
    "知识管理": "自我成长",
    "写作": "自我成长",
    "冥想": "自我成长",
    "内观": "自我成长",
    "心理健康": "自我成长",
    "习惯": "自我成长",

    // 英语学习
    "英语学习": "英语学习",
    "口语": "英语学习",
    "听力": "英语学习",
    "考试技巧": "英语学习",
    "ielts": "英语学习",
    "雅思": "英语学习",
    "学习方法": "英语学习",
    "娱乐学习": "英语学习",

    // 年终总结
    "年终总结": "年终总结",
    "回顾": "年终总结",

    // 科技/人工智能
    "人工智能": "科技/人工智能",
    "AI": "科技/人工智能",
    "ChatGPT": "科技/人工智能",
    "OpenAI": "科技/人工智能",
    "Sam Altman": "科技/人工智能",
    "未来工作": "科技/人工智能",
    "科技": "科技/人工智能",
    "自动化": "科技/人工智能",
};

function parseFrontmatter(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    return { frontmatter: match[1], body: match[2] };
}

function updateFrontmatter(filename: string) {
    const filePath = path.join(BLOG_DIR, filename);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(content);
    if (!parsed) return;

    const { frontmatter, body } = parsed;
    const lines = frontmatter.split("\n");
    let tags: string[] = [];
    let inTags = false;

    const newLines = lines.map(line => {
        if (line.startsWith("tags:")) {
            inTags = true;
            return line;
        }
        if (inTags && line.startsWith("  - ")) {
            tags.push(line.replace("  - ", "").trim());
            return null;
        }
        if (inTags && line.trim() === "") {
            return line;
        }
        if (inTags && !line.startsWith("  - ")) {
            inTags = false;
        }
        return line;
    }).filter(l => l !== null);

    // Map old tags to new categories
    const newCategories = new Set<string>();
    tags.forEach(tag => {
        const category = MAPPING[tag];
        if (category) {
            newCategories.add(category);
        }
    });

    // If no mapping found, try to find a category that matches partially or defaults to "思考哲学"
    if (newCategories.size === 0) {
        newCategories.add("思考哲学");
    }

    const tagsIdx = newLines.findIndex(l => l.startsWith("tags:"));
    const tagsList = Array.from(newCategories).map(cat => `  - ${cat}`);
    newLines.splice(tagsIdx + 1, 0, ...tagsList);

    const newContent = `---\n${newLines.join("\n")}\n---\n${body}`;
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Updated ${filename}: [${tags.join(", ")}] -> [${Array.from(newCategories).join(", ")}]`);
}

const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith(".md"));
files.forEach(updateFrontmatter);
