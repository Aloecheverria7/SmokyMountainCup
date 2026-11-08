


<?php
    // Configuración de la base de datos
    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto si tu servidor de MySQL no está en localhost
    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu usuario de MySQL
    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu contraseña de MySQL
    // Legacy database configuration removed; use app/bootstrap.php.

    // Crear conexión
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Verificar conexión
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    } 


  function mostrarEquiposPorCategoria($conn) {
    // Consulta para obtener categorías, grupos y equipos con estadísticas
    $sql = "
        SELECT 
            c.name AS categoria, 
            g.name AS grupo, 
            t.name AS equipo,
            ts.games_played AS juegos,
            ts.wins AS ganados,
            ts.draws AS empates,
            ts.losses AS perdidos,
            ts.goals_scored AS goles_favor,
            ts.goals_conceded AS goles_contra,
            ts.goal_difference AS diferencia_goles,
            ts.points AS puntos
        FROM teams t
        INNER JOIN group_teams gt ON t.id = gt.team_id
        INNER JOIN groups g ON gt.group_id = g.id
        INNER JOIN categories c ON g.category_id = c.id
        INNER JOIN team_stats ts ON t.id = ts.team_id
        ORDER BY c.name, g.name, t.name
    ";

    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        $currentCategory = null;
        $currentGroup = null;
        $pos = 1; // Posición inicial para los equipos
        while ($row = $result->fetch_assoc()) {
            $categoria = $row['categoria'];
            $grupo = $row['grupo'];

            if ($categoria !== $currentCategory) {
                if ($currentCategory !== null) {
                    // Cerrar la tabla anterior
                    echo "</tbody></table>";
                }
                // Nueva categoría
                echo "<h2>{$categoria}</h2>";
                $currentCategory = $categoria;
                $currentGroup = null; // Reset group for new category
            }

            if ($grupo !== $currentGroup) {
                if ($currentGroup !== null) {
                    // Cerrar la tabla anterior de grupo
                    echo "</tbody></table>";
                }
                // Nuevo grupo
                echo "<h3>{$grupo}</h3>";
                echo "<table>
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Equipo</th>
                                <th>J</th>
                                <th>G</th>
                                <th>E</th>
                                <th>P</th>
                                <th>GF</th>
                                <th>GC</th>
                                <th>DF</th>
                                <th>Puntos</th>
                            </tr>
                        </thead>
                        <tbody>";
                $currentGroup = $grupo;
                $pos = 1; // Reset position counter for new group
            }

            // Datos del equipo
            echo "<tr>
                    <td>{$pos}</td>
                    <td>{$row['equipo']}</td>
                    <td>{$row['juegos']}</td>
                    <td>{$row['ganados']}</td>
                    <td>{$row['empates']}</td>
                    <td>{$row['perdidos']}</td>
                    <td>{$row['goles_favor']}</td>
                    <td>{$row['goles_contra']}</td>
                    <td>{$row['diferencia_goles']}</td>
                    <td>{$row['puntos']}</td>
                  </tr>";
            $pos++;
        }
        // Cerrar la última tabla abierta
        echo "</tbody></table>";
    } else {
        echo "<p>No hay datos disponibles</p>";
    }
}

?>


<!-- Uso de la función -->
<!--< ?php
// Supongamos que $conn es tu conexión a la base de datos
mostrarEquiposPorCategoria($conn);
?>


<!-- Uso de la función -->
<!-- < ?php
// Supongamos que $conn es tu conexión a la base de datos
<!--  mostrarEquiposPorCategoria($conn);
<!-- ? >

    // Mostrar equipos por cada categoría
    
    // mostrarEquiposPorCategoria($conn, 'Premier');
    // mostrarEquiposPorCategoria($conn, 'Primera');
    // mostrarEquiposPorCategoria($conn, 'Femenil');

    // Cerrar conexión
    // $conn->close();
    ?>

?>-->




<div class="gdlr-core-pbf-wrapper " style="padding: 100px 0px 50px 0px;" id="gdlr-core-wrapper-2">
    <div class="gdlr-core-pbf-background-wrap"></div>
    <div class="gdlr-core-pbf-wrapper-content gdlr-core-js ">
        <div class="gdlr-core-pbf-wrapper-container clearfix gdlr-core-container">


            <div class="gdlr-core-pbf-column gdlr-core-column-60">
                <div class="gdlr-core-pbf-column-content-margin gdlr-core-js ">
                    <div class="gdlr-core-pbf-column-content clearfix gdlr-core-js ">
                        

                        <div class="container">
                            <div class="display-flex">
                                <h3> Position Tables </h3>
                            </div>
                        </div>

                      

                        <div class="gdlr-core-pbf-element">
                            <div class="gdlr-core-text-box-item gdlr-core-item-pdlr gdlr-core-item-pdb gdlr-core-left-align gdlr-core-no-p-space"
                                style="padding-bottom: 0px ;">
                                <div class="gdlr-core-text-box-item-content" style="text-transform: none ;">
                                    <div class="sportspress sp-widget-align-none">
                                        <div class="sp-template sp-template-event-list">
                                            <h4 class="sp-table-caption">Categories - Groups</h4>
                                            <div class="sp-table-wrapper">
                                               <?php echo mostrarEquiposPorCategoria($conn, 'Femenil')?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                      
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>


<?php $conn->close();?>