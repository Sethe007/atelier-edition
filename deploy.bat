@echo off
cd /d "I:\atelier-edition"

echo === Initialisation Git ===
git init
git branch -M main

echo === Création du .gitignore ===
(
echo node_modules/
echo dist/
echo .env
echo .DS_Store
echo *.log
) > .gitignore

echo === Ajout de tous les fichiers ===
git add .
git status --short

echo === Commit initial ===
git commit -m "feat: initial commit — Atelier Edition v2.0"

echo.
echo ============================================================
echo  ACTION REQUISE : Crée le repo GitHub MAINTENANT
echo  1. Va sur https://github.com/new
echo  2. Nom du repo : atelier-edition
echo  3. Visibilite : Public
echo  4. NE PAS cocher README ni .gitignore
echo  5. Clique "Create repository"
echo  Puis appuie sur une touche ici pour continuer...
echo ============================================================
pause

echo === Connexion au repo GitHub ===
git remote add origin https://github.com/Sethe007/atelier-edition.git

echo === Push ===
git push -u origin main

echo.
echo === TERMINE ! L'app est sur GitHub. ===
echo Vercel va detecter le repo automatiquement si tu le connectes.
pause
