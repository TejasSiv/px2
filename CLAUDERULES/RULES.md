# AI Agent Hard Rules - No Hallucination Policy

## Document Information
- **Project**: Multi-Drone Delivery System
- **Purpose**: Mandatory rules to prevent AI agent hallucination during development
- **Enforcement**: CRITICAL - All rules must be followed without exception

---

## HARD RULES - ZERO TOLERANCE

### Code Generation Rules
1. **NEVER invent API endpoints that don't exist in the documented architecture**
2. **NEVER create database table names not specified in database-architecture.md**
3. **NEVER reference environment variables not defined in the project documentation**
4. **NEVER assume configuration options that aren't explicitly documented**
5. **NEVER create fictional npm packages or Python libraries**
6. **NEVER generate files exceeding 2000 lines - split into smaller modules instead**

### Technology Stack Rules
6. **ONLY use technologies explicitly listed in system-architecture.md**
7. **NEVER suggest alternative frameworks not mentioned in the tech stack**
8. **NEVER invent ROS2 topics or services not defined in simulation-architecture.md**
9. **NEVER create Docker container names different from docker-compose specifications**
10. **NEVER assume ports or network configurations not documented**

### Database Rules
11. **ONLY reference tables and columns from database-architecture.md schema**
12. **NEVER create foreign key relationships not shown in the documentation**
13. **NEVER assume Redis key patterns not specified in the caching strategy**
14. **NEVER invent database indexes not mentioned in the performance specs**
15. **NEVER create stored procedures or triggers not documented**

### File Structure Rules
16. **ONLY reference file paths shown in the documented folder structure**
17. **NEVER create directories not specified in system-architecture.md**
18. **NEVER assume configuration files that don't exist in the documentation**
19. **NEVER reference Docker volumes not defined in docker-compose.yml**
20. **NEVER create launch files not specified in ROS2 documentation**

### Component Rules
21. **ONLY create React components that align with ui-ux-architecture.md**
22. **NEVER invent props interfaces not consistent with the design system**
23. **NEVER create custom hooks not following the documented patterns**
24. **NEVER assume state management approaches not specified**
25. **NEVER create utility functions outside documented patterns**

### API Rules
26. **ONLY use HTTP methods and endpoints from api-design-guidelines.md**
27. **NEVER create response formats different from documented standards**
28. **NEVER assume authentication methods not specified**
29. **NEVER invent error codes not defined in the error handling specs**
30. **NEVER create middleware not mentioned in the architecture**

### Testing Rules
31. **ONLY create tests following the exact patterns in testing standards**
32. **NEVER assume test frameworks not specified in the documentation**
33. **NEVER create mock objects with methods not in the real interfaces**
34. **NEVER invent test data that doesn't match schema constraints**
35. **NEVER assume testing environments not documented**

### Performance Rules
36. **NEVER claim performance metrics not specified in the requirements**
37. **NEVER assume caching strategies not documented in Redis standards**
38. **NEVER create performance optimizations not mentioned in guidelines**
39. **NEVER assume monitoring tools not specified in the architecture**
40. **NEVER invent benchmarking approaches not documented**

### Deployment Rules
41. **ONLY reference deployment steps from documented procedures**
42. **NEVER assume cloud services not mentioned in infrastructure docs**
43. **NEVER create environment configurations not specified**
44. **NEVER assume scaling approaches not documented**
45. **NEVER invent monitoring or logging setups not specified**

### Version Rules
46. **ONLY reference exact versions specified in package.json or requirements**
47. **NEVER assume library versions not explicitly documented**
48. **NEVER create version compatibility matrices not provided**
49. **NEVER suggest upgrades without checking documented constraints**
50. **NEVER assume dependency relationships not specified**

---

## VERIFICATION REQUIREMENTS

### Before Every Response
- **✅ Check**: Does this reference documented architecture?
- **✅ Check**: Are all file paths from the documented structure?
- **✅ Check**: Are all APIs from the specified endpoints?
- **✅ Check**: Are all database elements from the schema?
- **✅ Check**: Are all technologies from the approved stack?

### When Uncertain
- **❌ DO NOT GUESS** - State "Not specified in documentation"
- **❌ DO NOT ASSUME** - Ask for clarification instead
- **❌ DO NOT EXTRAPOLATE** - Stick exactly to documented facts
- **❌ DO NOT INVENT** - Only use explicitly documented elements
- **❌ DO NOT IMPROVISE** - Follow documented patterns exactly

### Documentation Sources (ONLY THESE)
- system-architecture.md
- database-architecture.md  
- simulation-architecture.md
- integration-architecture.md
- ui-ux-architecture.md
- product-requirements.md
- coding-standards.md

---

## VIOLATION CONSEQUENCES

**ANY VIOLATION OF THESE RULES RESULTS IN:**
- Immediate code rejection
- Required documentation review
- Complete response regeneration
- Mandatory rule re-verification

**NO EXCEPTIONS. NO FLEXIBILITY. NO INTERPRETATION.**