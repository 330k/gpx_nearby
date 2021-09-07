#!/bin/bash

find ./ -iname "*.json" | while read i
do
  file=${i%.*}.js
  echo -n 'loaddata(' > $file
  cat $i | jq -c >> $file
  echo ')' >> $file

done
