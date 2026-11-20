# Worked example: how one student's score is calculated

**Student:** skills = SQL, Excel, Power BI, Python; interests = data, business; theoretical experience.

Formula: `final = 0.5 x weighted_skill + 0.3 x tfidf_cosine + 0.2 x interest`

## Data Analyst

**1. Weighted skill match.** Each career lists skills with an importance weight (1-5). We add up the weights of the skills the student has.

| Skill | Weight | Student has it? |
|---|---|---|
| sql | 5 | yes |
| excel | 5 | yes |
| data visualization | 4 | no |
| power bi | 4 | yes |
| statistics | 4 | no |
| data cleaning | 4 | no |
| tableau | 3 | no |
| python | 3 | yes |
| pandas | 3 | no |
| eda | 3 | no |
| communication | 2 | no |

Weighted skill = 17 / 40 = **0.425**

**2. TF-IDF cosine similarity.** The career and the student are each turned into a vector over the skill vocabulary. TF-IDF gives rare, distinctive skills more weight than common ones, and cosine similarity measures the angle between the two vectors (1 = identical direction, 0 = nothing in common). Result: **0.683**

**3. Interest match.** The career's interest tags are data, analytics, business, visualization, reporting. The student's interests touch 2 of 5 of them = **0.400**

**4. Final score** = 0.5 x 0.425 + 0.3 x 0.683 + 0.2 x 0.400 = 0.497 -> **49.7%**

Missing core skills the student should learn: data cleaning, data visualization, statistics.

## Data Scientist

**1. Weighted skill match.** Each career lists skills with an importance weight (1-5). We add up the weights of the skills the student has.

| Skill | Weight | Student has it? |
|---|---|---|
| python | 5 | yes |
| statistics | 5 | no |
| machine learning | 5 | no |
| pandas | 4 | no |
| numpy | 4 | no |
| scikit-learn | 4 | no |
| eda | 4 | no |
| sql | 3 | yes |
| data visualization | 3 | no |
| feature engineering | 3 | no |
| linear algebra | 3 | no |
| matplotlib | 2 | no |
| deep learning | 2 | no |

Weighted skill = 8 / 47 = **0.170**

**2. TF-IDF cosine similarity.** The career and the student are each turned into a vector over the skill vocabulary. TF-IDF gives rare, distinctive skills more weight than common ones, and cosine similarity measures the angle between the two vectors (1 = identical direction, 0 = nothing in common). Result: **0.153**

**3. Interest match.** The career's interest tags are data, statistics, machine learning, research, prediction. The student's interests touch 1 of 5 of them = **0.200**

**4. Final score** = 0.5 x 0.170 + 0.3 x 0.153 + 0.2 x 0.200 = 0.171 -> **17.1%**

Missing core skills the student should learn: eda, machine learning, numpy, pandas, scikit-learn, statistics.

**Ranking:** Data Analyst 49.7%, Data Scientist 17.1%, Python Developer 15.4%.
