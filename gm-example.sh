gm convert \
  ./app/resources/img/nazare.jpg \
  -font ./app/resources/fonts/impact.ttf \
  -pointsize 50 \
  -fill "#FFF" \
  -stroke "#000" \
  -strokewidth 1 \
  -draw "gravity center text 0,-155 \"Quando eu pago\"" \
  -draw "gravity center text 0,155 \"e fico calculando o troco\"" \
  output.png

echo "Processo concluido"